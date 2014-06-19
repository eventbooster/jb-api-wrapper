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
		* Makes API call and handles data
		* @return {promise} Promise that will be resolved when answer is fine, else rejected
		*/
		function callAPI( requestData, responseData ) {

			console.log( "REQUEST " + requestData.url + " (" + requestData.method + ")" ); 

			// #todo: remove. will be done by server
			requestData.headers = requestData.headers || {};
			requestData.headers[ "api-version"] = requestData.headers["api-version"] || "0.1"
			requestData.headers[ "content-language"] = requestData.headers["content-language"] || $( "html").attr( 'lang' );

			requestData.data = requestData.data || {};
			requestData.data.id_tenant = requestData.data.id_tenant || 1;

			return $http( requestData )
				.then( function( resp ) {
					return handleSuccess( resp, responseData.requiredProperties, responseData.returnProperty )
				}, function( reason ) {
					return $q.reject( { message: "HTTP " + requestData.method + " request to " + requestData.url + " (" + requestData.method + ") failed (status " + reason.status + ")", code: "serverError"} );
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
				return $q.reject( { code: "serverError", message: "Status not 200" } );
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