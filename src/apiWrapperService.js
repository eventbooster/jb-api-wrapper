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
		* Returns true if browser supports formData; else false
		*/
		function supportsFormData() {
			//return false;
			return window.FormData !== undefined;
		}




		/**
		* Pseudo formData function for IE9 etc.
		*/
		function FakeFormData() {
			var fields = [];
			return {

				// Fake implementation of the append method
				append: function( name, data ) {
					fields.push( { name: name, data: data } );
				}

				// Returns the fields
				, _getFields: function() {
					return fields;
				}

				// Returns string
				, _toString: function() {

					var boundary 			= "--EB-Boundary" + generateBoundary()
						, formDataString 	= ""
						, newLine 			= "\r\n";

					// Join all fields
					for( var i = 0; i < fields.length; i++ ) {
						formDataString += boundary + newLine;
						formDataString += 'Content-Disposition: form-data; name="' + fields[ i ].name + '"';
						formDataString += newLine + newLine;
						formDataString += fields[ i ].data;
						formDataString += newLine;
					}

					// Closing statement
					formDataString += boundary;
					formDataString += "--" + newLine;

					console.log( "FormData: \n%s", formDataString );
					return {
						data 		: formDataString
						, boundary 	: boundary
					}

				}
			}
		}





		/**
		* Transforms data into formData, to be sent through XHR
		* @returns <Object> 		FormData object if browser supports it. Else
		* 							{
		*								data 		: "" // FormData string
		*								, boundary 	: "" // Boundary used to generate FormData string
		*							}
		*/
		function transformToMultipart( data ) {

			// Initialize form data object (fake or real for real browsers)
			var formDataObject = supportsFormData() ? new FormData() : new FakeFormData();

			// Generate form data
			var formData = generateFormDataFromData( data, formDataObject );

			// For browsers not supporting formData: generate String from fake FormData object
			if( !supportsFormData() ) {
				formData = formData._toString();
			}

			return formData;

		}








		/**
		* Add all (relevant) content of param data to formData
		* Flattens everything out; only name and value of an object are put into formData
		* no matter where and how deeply hidden they are
		*
		* Don't just use new FormData(data) to ensure that FormData() and FakeFormData() contain exactly
		* the same values.
		*
		* @param <Object, Array> data 		Data to be serialized to Multipart
		* @param <FormData> formData 		FormData() or FakeFormData() to which data is appended
		*/
		function generateFormDataFromData( data, formData ) {

			if( angular.isObject( data ) ) {

				for( var i in data ) {

					// Not own property
					if( !data.hasOwnProperty( i ) ) {
						continue;
					}

					// Object/Array: Recurse
					if( angular.isObject( data[ i ] ) || angular.isArray( data[ i ] ) ) {


						// Is a file: Upload 
						console.log( "obj %o", data[ i ] );
						if( window.File && data[ i ] instanceof File ) {
							console.warn( "Add file to formData" );
							formData.append( i, data[ i ] );
							continue;
						}

						generateFormDataFromData( data[ i ], formData );

					}

					else if( typeof data[ i ] === "string" || typeof data[ i ] === "number" || typeof data[ i ] === "boolean" ) {

						formData.append( i, data[ i ] );

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
						generateFormDataFromData( data[ i ], formData );
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
				

				var multiPartData = transformToMultipart( requestData.data );


				// FormData supported: set data to FormData object
				if( supportsFormData() ) {
	
					requestData.data = multiPartData;

					// Set content-type header to false or it won't be generated by angular/js/whatever
					requestData.headers[ "Content-Type" ] = undefined;

					// Stupid angular does transform request with FormData … prevent that by using custom transformRequest method.
					// Thanks a lot, Jenny! http://uncorkedstudios.com/blog/multipartformdata-file-upload-with-angularjs
					requestData.transformRequest = angular.identity;

				}

				// FormData not supported: set data to string, set header manually
				else {
					requestData.data = multiPartData.data;
					requestData.headers[ "Content-Type" ] = "multipart/form-data; boundary=" + multiPartData.boundary.substr(2);
				}

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