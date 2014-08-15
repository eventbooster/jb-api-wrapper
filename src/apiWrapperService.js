/**
* Wrapper for calls to API; checks responses for errors and handles them.
*
* Usage: ApiWrapperService.call( { method: "", url: "", data: {} }, { requiredProperties: [], returnProperty: ""|fn })
* Returns promise
*/



angular
	.module( "eb.apiWrapper", [] )
	.factory( "APIWrapperService", [ "$q", "$http", function( $q, $http ) {
		



		/**
		* Takes JSON and makes an multipart/form-data string out of it; #todo IE9 support
		*/
		function transformJsonToMultipart( json ) {

			// Don't use FormData – not supported by IE9
			//var formData = new FormData();

			// Remove $$hashKey etc. 
			// See https://github.com/angular/angular.js/issues/1875
			var data = JSON.parse( angular.toJson( json ) );


			var boundary = "------EB-Boundary" + generateBoundary();

			var formData = generateMultipartFieldsFromData( data, boundary, [] );
			formData = formData.join( "" );

			// Append final boundary
			formData += boundary + "--";
			
			//console.log( "Form Data: %o became %s", json, formData );

			return {
				boundary 	: boundary
				, data  	: formData
			}

		}


		/**
		* Generates multipart fields from anything recursively
		* Flattens everything out; only name and value of an object are put into multipart data, 
		* no matter where and how deeply hidden they are
		* @param <Object, Array> data 		Data to be serialized to Multipart
		* @param <String> boundary 			Boundary for Multipart
		* @param <Array> Multipart 			Multipart data gotten so far (recursion, as an array so that it can be
		* 									passed as a reference
		*/
		function generateMultipartFieldsFromData( data, boundary, multipart ) {

			if( angular.isObject( data ) ) {

				for( var i in data ) {

					//console.log( "parse %o", data[ i ] );

					// Not own property
					if( !data.hasOwnProperty( i ) ) {
						continue;
					}

					// Object/Array: Recurse
					if( angular.isObject( data[ i ] ) || angular.isArray( data[ i ] ) ) {
						generateMultipartFieldsFromData( data[ i ], boundary, multipart );
					}

					else if( typeof data[ i ] === "string" || typeof data[ i ] === "number" || typeof data[ i ] === "boolean" ) {
						currentFormData = boundary + "\n";
						currentFormData += 'Content-Disposition: form-data; name="' + i + '"';
						currentFormData += "\n\n";
						currentFormData += data[ i ];
						currentFormData += "\n";
						multipart.push( currentFormData );
					}

					else if(data[ i ] === undefined ) {
						console.log( "Empty field for multipart data: " + JSON.stringify( data[ i ] ) );
						continue;
					}

					else {
						console.error( "Can't append to formdata, unknown format: " + JSON.stringify( data[ i ] ) )
					}

				}

			}

			else if (angular.isArray( data ) ) {

				for( var i = 0; i < data.length; i++ ) {

					if( angular.isArray( data[ i ] ) || angular.isObject( data[ i ] ) ) {
						generateMultipartFieldsFromData( data[ i ], boundary, multipart );
					}

					else {
						console.error( "Unknown type for array, can't append to formData: " + JSON.stringify( data[ i ] ) );
					}

				}

			}

			else if( data === undefined ) {
				"Got undefined data for generating multipart: " + JSON.stringify( data );
			}

			else {
				console.error( "Unknown type, can't append to formData: " + JSON.stringify( data ) );
			}

			return multipart;

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

			// #todo: remove. will be done by server
			requestData.headers = requestData.headers || {};
			requestData.headers[ "Api-Version"] = requestData.headers["api-version"] || "0.1"

			var lang = $( "html" ).attr( 'lang' );
			requestData.headers[ "Accept-Language" ] 	= requestData.headers["accept-language"] || lang;
			requestData.headers[ "Content-Language" ] 	= requestData.headers["content-language"] || lang;

			// Disable caching
			requestData.headers[ "Pragma" ] 			= requestData.headers["pragma"] || "no-cache";
			requestData.headers[ "Cache-Control" ] 		= requestData.headers["cache-control"] || "no-cache";

			// Add authorization (dirty, dirty!)
			if( localStorage && localStorage.getItem( "requestToken" ) ) {
				requestData.headers[ "Authorization" ] = requestData.headers[ "Authentication" ] || "ee-simple " + localStorage.getItem( "requestToken" );
			}

			requestData.data = requestData.data || {};

			// Convert data to Multipart/Form-Data and set header correspondingly
			// if we're PUTting, PATCHing or POSTing
			var meth = requestData.method.toLowerCase();
			if( meth === "post" || meth == "put" || meth == "patch" ) {
					
				var multiPartData = transformJsonToMultipart( requestData.data );

				// Let user set content type: https://groups.google.com/forum/#!topic/angular/MBf8qvBpuVE
				// In case of files, boundary ID is needed; can't be set manually.
				requestData.headers[ "Content-Type" ] = "multipart/form-data; boundary=" + multiPartData.boundary; 

				requestData.data = multiPartData.data;

			}

			// Disable caching
			requestData.cache = false;

			// IE f***ing 9 f****ng cashes all f*****ng get requests
			if( meth === "get" ) {
				requestData.params = requestData.params || {};
				requestData.params[ "_nocache" ] = new Date().getTime() + Math.round( Math.random() * 500 );
			}			

			return $http( requestData )
				.then( function( resp ) {
					return handleSuccess( resp, responseData.requiredProperties, responseData.returnProperty )
				}, function( response ) {
					var message = response.data && response.data.msg ? response.data.msg : response.data;
					return $q.reject( { message: "HTTP " + requestData.method + " request to " + requestData.url + " (" + requestData.method + ") failed. Status " + response.status + ". Reason: " + message + ".", code: "serverError", statusCode: response.status } );
				} )
		}




		/**
		* Checks a API response for it's validity (all required data )
		* @return {promise} 					Promise that is resolved if everything is fine, else rejected
		* @param {array} requiredProperties		Array of properties that response.data must contain to be valid
		* @param {array} returnProperty 		Name of the property that the promise will be resolved with
		* 										(property of response.data)
		*/
		function handleSuccess( response, requiredProperties, returnProperty ) {

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
				return returnProperty( response.data )
			}

			// returnProperty is nothing or a string
			else {
				return response.data[ returnProperty ];
			}

		}





		return {
			request: callAPI
		}




	} ] );