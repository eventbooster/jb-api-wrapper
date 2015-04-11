/**
* Wrapper for calls to API; checks responses for errors and handles them.
*
* Usage: ApiWrapperService.call( { method: "", url: "", data: {} }, { requiredProperties: [], returnProperty: ""|fn })
* Returns promise
*/

( function() {

	'use strict';

	angular
	.module( "eb.apiWrapper", [] )
	.factory( "APIWrapperService", [ "$q", "$http", function( $q, $http ) {
			

		/**
		* Returns true if browser supports formData
		*/
		function supportsFormData() {
			//return false;
			return window.FormData;
		}


		/**
		* Creates FormData-like object on browsers that don't support FormData (hi there, IE9)
		* Exposes the same functions (i.e. append) as FormData. 
		* Does NOT support file uploads!
		* _toString method returns data and boundary.
		*/
		function FakeFormData() {
			var fields = [];
			return {
				append: function(name, data) {
					fields.push({
						name	: name,
						data	: data
					});
				},
				_getFields: function() {
					return fields;
				},
				_toString: function() {
					// Dirty compiled shit. Rewrite when we got time. 
					for (var boundary = "--EB-Boundary" + generateBoundary(), formDataString = "", newLine = "\r\n", i = 0; i < fields.length; i++) formDataString += boundary + newLine, 
					formDataString += 'Content-Disposition: form-data; name="' + fields[i].name + '"', 
					formDataString += newLine + newLine, formDataString += fields[i].data, formDataString += newLine;
					return formDataString += boundary, formDataString += "--" + newLine, console.log("FormData: \n%s", formDataString), 
					{
						data: formDataString,
						boundary: boundary
					};
				}
			};
		}




		/**
		* Takes JSON and makes an multipart/form-data string out of it; #todo IE9 support
		*/
		function transformToMultipart( data ) {

			var formDataObject	= supportsFormData() ? new FormData() : new FakeFormData()
				, formData		= generateFormDataFromData( data, formDataObject );

			return supportsFormData() ? formData : formData._toString();

		}





		/**
		* Takes data and appends it to formData. formData is the browser's FormData implementation or the fake implementation
		* for non-supportive browsers
		* @param <Object, Array> data		Object of data to be sent with request
		* @param <Object> formData			FormData() or FakeFormData() to which data is appended
		*/
		function generateFormDataFromData(data, formData) {

			// Object
			if( angular.isObject( data ) ) {
				
				// Go through data's properties
				for( var i in data ) {

					// Object
					if( angular.isObject( data[ i ] ) ) {
						
						// File
						if( window.File && data[ i ] instanceof File ) {

							// Browser doesn't support FormData – can't upload file
							if( !supportsFormData() ) {
								console.error( 'You can\'t upload files; browser doesn\'t support FormData' );
							}
							else {
								formData.append( i, data[ i ] );
							}
						}

						// Not a file 
						else {
							generateFormDataFromData( data[ i ], formData );
						}

					}

					// String, number, boolean
					else if( typeof data[ i ] === 'string' || typeof data[ i ] === 'number' || typeof data[ i ] === 'boolean' ) {
						formData.append( i, data[ i ] );
					}

					// undefined, null
					else if( data === undefined || data === null ) {
						formData.append( i, '' );
					}

				}

			}

			// Array
			// Add data recursively
			else if ( angular.isArray( data ) ) {

				// Append data recursively
				for( var j = 0; j < data.length; j++ ) {
					generateFormDataFromData( data[ j ], formData );
				}

			}

			// Unknown
			else {
				console.error( 'EBAPIWrapper: Unknown type was passed to generateFormDataFromData: %o', data );
			}

			return formData;


		}




		/**
		* Returns a UID for a boundary
		*/
		function generateBoundary() {
			
			function s4() {
    			return Math.floor((1 + Math.random()) * 0x10000)
               		.toString(16)
               		.substring(1);
  			}

			return function() {
    			return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4();
			}();

		}





		/**
		* Makes API call and handles data
		* @return {promise} Promise that will be resolved when answer is fine, else rejected
		*/
		function callAPI( requestData, responseData ) {

			console.log( "REQUEST " + requestData.url + " (" + requestData.method + ")" ); 

			var meth = requestData.method.toLowerCase();

			// #todo: remove. will be done by server
			requestData.headers = requestData.headers || {};
			requestData.headers[ "Api-Version"] = requestData.headers["api-version"] || "0.1";

			var lang = $( "html" ).attr( 'lang' );
			requestData.headers[ "Accept-Language" ] 	= requestData.headers["accept-language"] || lang;


			// Disable caching
			requestData.headers.Pragma 					= requestData.headers.pragma || "no-cache";
			requestData.headers[ "Cache-Control" ] 		= requestData.headers["cache-control"] || "no-cache";

			// Add authorization (dirty, dirty!)
			if( localStorage && localStorage.getItem( "requestToken" ) ) {
				requestData.headers.Authorization = requestData.headers.Authentication || "ee-simple " + localStorage.getItem( "requestToken" );
			}

			requestData.data = requestData.data || {};

			// Convert data to Multipart/Form-Data and set header correspondingly
			// if we're PUTting, PATCHing or POSTing
			if( meth === "post" || meth == "put" || meth == "patch" ) {

				// Content-language is only needed on requests that write to the server
				requestData.headers[ "Content-Language" ] 	= requestData.headers["content-language"] || lang;
								
				var multiPartData = transformToMultipart( requestData.data );

				// Let user set content type: https://groups.google.com/forum/#!topic/angular/MBf8qvBpuVE
				// In case of files, boundary ID is needed; can't be set manually.
				// Content-Type needs only to be set if browser doesn't support FormData
				requestData.headers[ "Content-Type" ] = supportsFormData() ? undefined : "multipart/form-data; boundary=" + multiPartData.boundary.substr(2);

				requestData.data = supportsFormData() ? multiPartData : multiPartData.data;

				// Prevent angular from serializing our request data – especially for files
				// http://uncorkedstudios.com/blog/multipartformdata-file-upload-with-angularjs
				requestData.transformRequest = angular.identity;

			}

			// Disable caching
			requestData.cache = false;

			// IE f***ing 9 f****ng cashes all f*****ng get requests
			if( meth === "get" ) {
				requestData.params = requestData.params || {};
				requestData.params._nocache = new Date().getTime() + Math.round( Math.random() * 500 );
			}

			return $http( requestData )
				.then( function( resp ) {
					return handleSuccess( resp, responseData );
				}, function( response ) {
					var message = response.data && response.data.msg ? response.data.msg : response.data;
					return $q.reject( { message: "HTTP " + requestData.method + " request to " + requestData.url + " (" + requestData.method + ") failed. Status " + response.status + ". Reason: " + message + ".", code: "serverError", statusCode: response.status } );
				} );

		}




		/**
		* Checks a API response for it's validity (all required data )
		* @return {promise} 					Promise that is resolved if everything is fine, else rejected
		* @param {array} requiredProperties		Array of properties that response.data must contain to be valid
		* @param {array} returnProperty 		Name of the property that the promise will be resolved with
		* 										(property of response.data)
		*/
		function handleSuccess( response, responseHandlers ) {

			var requiredProperties 		= responseHandlers ? responseHandlers.requiredProperties 	: undefined
				, returnProperty 		= responseHandlers ? responseHandlers.returnProperty 		: undefined;

			// Bad status: not 200 or 201, 
			// see https://github.com/joinbox/guidelines/blob/master/styleguide/RESTful.md#Range, basically
			// handled by errorHandler on $http also
			if( response.status !== 200 && response.status !== 201 ) {
				return $q.reject( { code: "serverError", message: "Status not 200; got " + response.data, statusCode: response.status } );
			}

			// Got error as a response (or no response at all?)
			if( response && response.data && response.data.error ) {
				return $q.reject( { code: "serverError", message: "Server returned error: '" + response.data.msg + "'", statusCode: response.status } );
			}


			// Check if all requiredProperties are available
			if( requiredProperties && requiredProperties.length > 0 ) {

				// One of response's properties is missing
				for( var i = 0; i < requiredProperties.length; i++ ) {
					if( !response.data[ requiredProperties[ i ] ] ) {

						console.log( "Missing required properties %o in %o", requiredProperties, response.data );
						return $q.reject( { code: "serverError", message: "Missing property " + requiredProperties[ i ] + " in data", statusCode: response.status } );

					}
				}

			}


			// Everything fine

			// returnProperty is a function
			if( returnProperty && typeof( returnProperty ) === "function" ) {
				return returnProperty( response.data, response );
			}

			// returnProperty is nothing or a string
			else if( returnProperty ) {
				return response.data[ returnProperty ];
			}
			else {
				return response.data;
			}

		}





		return {
			request: callAPI
		};




	} ] )


	/**
	* Service that translates distributed time strings (YYYY-MM-DD HH:MM:SS) into
	* JS dates (with local UTC offset) and converts local dates with UTC offset into 
	* distributed time strings.
	*/
	.factory( 'APIDateService', [ '$filter', function( $filter ) {

		function pad( nr ) {
			var sign = nr < 0 ? '-' : ''
				, absNr = Math.abs( nr );
			return absNr <= 9 ? ( sign + '0' + nr ) : ( sign + absNr );
		}

		return {

			/**
			* Converts distibuted time string into JS date
			* @param {string} timeString		Date in the form of "2015-04-08 15:36:11"
			*/
			fromServer: function( timeString ) {

				console.log( 'APIDateService: Convert date %o from server', dateObject );

				// ISO 8601 date (2015-04-08T00:07:19+00:00)
				var isoString = timeString.replace( ' ', 'T' );
				var timezoneOffset = new Date().getTimezoneOffset(); 
				// Add +
				// - comes back with pad function
				if( timezoneOffset > 0 ) {
					timezoneOffset += '+';
				}
				isoString += pad( Math.floor( timezoneOffset / 60 ) ) + ':' + pad( timezoneOffset % 60 );

				console.error( isoString );

				return new Date( timeString );

			}

			, toServer: function( dateObject ) {

				console.log( 'APIDateService: Convert date %o for server', dateObject );

				// Timezoneoffset * -1 in ms
				var timezoneOffset		= new Date().getTimezoneOffset() * 60 * 1000
					, gtcDate			= new Date( dateObject.getTime() + timezoneOffset );


				return $filter( 'date' )( gtcDate, 'yyyy-MM-dd HH:mm:ss' );

			}

		};

	} ] );

}() );