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

			var formData = new FormData();

			for( var i in json ) {

				// own property?
				if( !json.hasOwnProperty( i ) ) {
					continue;
				}

				// Value is not string or int or float
				if( typeof json[ i ] !== "string" && typeof json[ i ] !== "number" && json[ i ] !== undefined ) {
					console.error( "You can't convert data that's not a number or a string to Multipart/Form-Data – yet. Sorry. (%o)", json[ i ] );
				}

				// Undefined or something: set to empty string as FormData will convert undefined to "undefined"
				if( !json[ i ] ) {
					json[ i ] = "";
				}


				formData.append( i, json[ i ] );

			}

			console.error( formData );

			return formData;

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

			requestData.data = requestData.data || {};
			requestData.data.id_tenant = requestData.data.id_tenant || 1;

			// Convert data to Multipart/Form-Data and set header correspondingly
			// if we're PUTting, PATCHing or POSTing
			var meth = requestData.method.toLowerCase();
			if( meth === "post" || meth == "put" || meth == "patch" ) {
				
				// Let user set content type: https://groups.google.com/forum/#!topic/angular/MBf8qvBpuVE
				// In case of files, boundary ID is needed; can't be set manually.
				requestData.headers[ "Content-Type" ] = undefined; 

				// Don't set data directly – angular will JSONify it
				requestData.transformRequest = function() {
					return transformJsonToMultipart( requestData.data );
				}

			}

			return $http( requestData )
				.then( function( resp ) {
					return handleSuccess( resp, responseData.requiredProperties, responseData.returnProperty )
				}, function( response ) {
					var message = response.data && response.data.msg ? response.data.msg : response.data;
					return $q.reject( { message: "HTTP " + requestData.method + " request to " + requestData.url + " (" + requestData.method + ") failed. Status " + response.status + ". Reason: " + message + ".", code: "serverError"} );
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
				return $q.reject( { code: "serverError", message: "Status not 200; got " + response.data } );
			}

			// Got error as a response (or no response at all?)
			if( response && response.data && response.data.error ) {
				return $q.reject( { code: "serverError", message: "Server returned error: '" + response.data.msg + "'" } );
			}


			// Check if all requiredProperties are available
			if( requiredProperties && requiredProperties.length > 0 ) {

				// One of response's properties is missing
				for( var i = 0; i < requiredProperties.length; i++ ) {
					if( !response.data[ requiredProperties[ i ] ] ) {

						$q.reject( { code: "serverError", message: "Missing property " + requiredProperties[ i ] + " in data" } );

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