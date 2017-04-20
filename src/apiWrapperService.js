/**
* Wrapper for calls to API; checks responses for errors and handles them.
*
* Usage: APIWrapperService.request( requestObject }, { requiredProperties: [], returnProperty: ''|fn })
* requestObject may contain the following properties: 
* - method
* - url
* - data: {}
* - headers: {}
*
* Default headers may be configured in angular's config phase.
*
* Data is sent as FormData except if the header «content-type» (or Content-Type) is provided. Then data is sent 
* in the form provided.
*
* @return Promise
* 
*/


// SHOULD ADD: 
// - abort()
// - loading status/progress (for image upload)
// - return request's headers and other data
( function() {

	'use strict';

	var _module = angular.module( 'jb.apiWrapper', [] );

	/**
	 * Provider for the APIWrapperService.
	 */
	_module.provider( 'APIWrapperService', [ function() {


		var   _defaultHeaders   = {}
            , _optionsFormatter = null
            , _cacheEnabled     = true;


		/**
		* Allow users to set default headers in config phase
		*/
		this.setDefaultHeaders = function( defaultHeaders ) {

			if( defaultHeaders ) {

				if( !angular.isObject( defaultHeaders ) ) {
					throw new Error( 'APIWrapperService: Default headers is not an object: ' + JSON.stringify( defaultHeaders ) );
				}

				_defaultHeaders = defaultHeaders;

			}

		};

        this.disableCache = function(){
            _cacheEnabled = false;
        };

        /**
         * Allows setting single headers in the config phase.
         *
         * @param key
         * @param value
         */
        this.setDefaultHeader = function(key, value) {
            _defaultHeaders[key] = value;
        };

        /**
         * Getter for the formatter so one could wrap it if needed.
         *
         * @returns {*}
         */
        this.getOptionsFormatter = function(){
            return _optionsFormatter;
        };

        /**
         * Setter for the formatter which must implement the format(object) method and return the value or a promise.
         *
         * @param formatter
         */
        this.setOptionsFormatter = function(formatter){
            _optionsFormatter = formatter;
        };


		// Returns service stuff (that might be used AFTER the config phase)
		this.$get = [ '$http', '$q', function( $http, $q ) {

			return new APIWrapper( $http, $q, _optionsFormatter, { headers: _defaultHeaders } , _cacheEnabled);

		} ];

	} ] );



	// Define the API Wrapper object
	var APIWrapper;

	// Hide all API Wrapper stuff from angular code
	( function() {

		var $q
			, $http
			, _defaults;

		APIWrapper = function( http, q, optionsFormatter, defaults , cacheEnabled) {

			// Browser doesn't support FormData
			if( !window.FormData ) {
				throw new Error( 'APIWrapperService: Your browser does not support FormData, this web application will be of no use for you. Sorry.' );
			}

			$q = q;
			$http = http;
            this.optionsFormatter   = optionsFormatter;
            this.optionsCache       = {};
            this.cacheEnabled       = cacheEnabled !== false;
			_defaults = defaults;

		};




		/**
		 * Set default header. Needed e.g. in login view:
		 * - In the app's config phase, the accessToken is not (yet) available
		 * - The token becomes available and must be used from then on.
		 */
		APIWrapper.prototype.setDefaultHeader = function( headerName, headerValue ) {

			_defaults.headers[ headerName ] = headerValue;

		};

        /**
         * @param <Object> requestData	Data necessary to make a request. May contain:
         *								- method (defaults to GET)
         *								- url (defaults to /)
         *								- data (Object or other, see generateFormDataFromData)
         *								- headers (Object)
         */
		APIWrapper.prototype.request = function( requestObject ) {

			return callAPI( requestObject );

		};

        APIWrapper.prototype._createRequestObject = function(method, url, headersAndData){

            var   requestData   = {}
                , options       = headersAndData || {}
                , headers       = options.headers
                , data          = options.data;

            requestData.method  = (method && angular.isString(method)) ? method.toLowerCase() : 'get';
            requestData.url     = url;
            requestData.headers = angular.isDefined(headers) ? headers : {};

            // Only set data if there is data present
            if(angular.isDefined(data)){
                requestData.data = data;
            }

            return requestData;
        };

        APIWrapper.prototype.get = function(url, headersAndData){
            return this.request(this._createRequestObject('get', url, headersAndData));
        };

        APIWrapper.prototype.put = function(url, headersAndData){
            return this.request(this._createRequestObject('put', url, headersAndData));
        };

        APIWrapper.prototype.post = function(url, headersAndData){
            return this.request(this._createRequestObject('post', url, headersAndData));
        };

        APIWrapper.prototype.patch = function(url, headersAndData){
            return this.request(this._createRequestObject('patch', url, headersAndData));
        };

        APIWrapper.prototype.options = function(url, headersAndData){
            return this.request(this._createRequestObject('options', url, headersAndData));
        };

        APIWrapper.prototype.delete = function(url, headersAndData){
            return this.request(this._createRequestObject('delete', url, headersAndData));
        };

        APIWrapper.prototype.getOptions = function(url, refreshCache){

			var basePromise;

			if(this.cacheEnabled){
                var cached = this.optionsCache[url];
                if(angular.isUndefined(cached) || refreshCache === true){
                    basePromise = this.options(url, {});
                    this.optionsCache[url] = basePromise;
                } else {
                    basePromise = cached;
                }
            } else {
                basePromise = this.options(url, {});
            }

            return basePromise.then(this.applyFormatter.bind(this));
        };

        APIWrapper.prototype.disableCache = function(){
            this.cacheEnabled = false;
        };

        APIWrapper.prototype.enableCache = function(){
            this.cacheEnabled = true;
        };

        APIWrapper.prototype.invalidateOptionsCache = function(){
            this.optionsCache = {};
        };

        APIWrapper.prototype.applyFormatter = function(data){
            if(!this.optionsFormatter || !angular.isFunction(this.optionsFormatter.format)) return data;
            return this.optionsFormatter.format(data);
        };



		/**
		* Takes data and appends it to formData. formData is the browser's FormData implementation or the fake implementation
		* for non-supportive browsers
		* @param <Object, Array> data		Object of data to be sent with request
		* @param <Object> formData			FormData() or FakeFormData() to which data is appended
		*/
		function generateFormDataFromData( data, formData ) {

			// Object
			if( angular.isObject( data ) ) {
				
				// Go through data's properties
				for( var i in data ) {

					// Object
					if( angular.isObject( data[ i ] ) ) {
						
						// File
						if( window.File && data[ i ] instanceof File ) {
							formData.append( i, data[ i ] );
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

					// undefined, null: send empty String
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
				console.error( 'APIWrapperService: Unknown type was passed to generateFormDataFromData: %o', data );
			}

			return formData;


		}




		/**
		* Returns an array of the most intensely used languages
		*/
		function getUserLanguages() {

			var defaultLanguages = [];

			// Languages: If not set, return html's language, then all languages supported by the browser (gotten from navigator.languages)
			var htmlLanguage			= document.querySelector( 'html' ).getAttribute( 'lang' );
			if( htmlLanguage ) {
				defaultLanguages.push( htmlLanguage );
			}

			if( navigator.languages ) {
				// Make sure languages are only «de» and not «de-CH» and they're unique.
				navigator.languages
					// de-CH -> de
					.map( function( lang ) {
						return lang.substr( 0, 2 );
					} )
					// Remove duplicates
					.forEach( function( lang ) {
						if( defaultLanguages.indexOf( lang ) === -1 ) {
							defaultLanguages.push( lang );
						}
					} );
			}

			return defaultLanguages;

		}





		/**
		* Makes API call and handles data
		* @param <Object> requestData	Data necessary to make a request. May contain: 
		*								- method (defaults to GET)
		*								- url (defaults to /)
		*								- data (Object or other, see generateFormDataFromData)
		*								- headers (Object)
		* @return <Promise> 			Promise that will be resolved when answer is fine, else rejected with a custom HTTPError
		*/

		function callAPI( requestData ) {


			// Method
			var validMethods = [ 'options', 'get', 'post', 'patch', 'put', 'delete' ];
			requestData.method = ( requestData.method && angular.isString( requestData.method ) ) ? requestData.method.toLowerCase() : 'get';

			if( validMethods.indexOf( requestData.method ) === -1 ) {
				return new Error( 'APIWrapperService: Invalid API request method: ' + requestData.method );
			}


			console.log( 'APIWrapperService: Request ' + requestData.url + ' (' + requestData.method + ') with data %o and headers %o', requestData.data, requestData.headers ); 



			// Headers
			requestData.headers = requestData.headers || {};
			if( _defaults && _defaults.headers ) {
				angular.extend( requestData.headers, _defaults.headers );
			}

			// Headers that stay the same across all implementations (therefore do not inject them in the config phase)
			requestData.headers[ 'Accept-Language' ] 	= requestData.headers[ 'accept-language' ] || requestData.headers[ 'Accept-Language' ] || getUserLanguages().join( ', ' );

			// Disable caching
			requestData.headers.Pragma 					= requestData.headers.pragma || requestData.headers.Pragma || 'no-cache';
			requestData.headers[ 'Cache-Control' ] 		= requestData.headers[ 'Cache-Control' ] || requestData.headers[ 'Cache-Control' ] || 'no-cache';

			// Data
			requestData.data = requestData.data || {};

			// Convert data to Multipart/Form-Data and set header correspondingly
			// if we're PUTting, PATCHing or POSTing
			if( requestData.method === 'post' || requestData.method == 'put' || requestData.method == 'patch' ) {


				// Content-Language is only needed on requests that write to the server
				requestData.headers[ 'Content-Language' ] 	= requestData.headers[ 'content-language' ] || requestData.headers[ 'Content-Language' ];
				if( getUserLanguages().length > 0 && !requestData.headers[ 'Content-Language' ] ) {
					requestData.headers[ 'Content-Language' ] = getUserLanguages()[ 0 ];
				}
				
				// Content-Type
				var contentType = requestData.headers[ 'content-type' ] || requestData.headers[ 'Content-Type' ];

				// If Content-Type is set and is application/json, stringify content, if needed
				if( contentType ) {

					// application/json: Stringify, if not already done.
					if( contentType.toLowerCase() === 'application/json' && !angular.isString( requestData.data ) ) {
						requestData.data = JSON.stringify( requestData.data );
					}

				}


				// Content-Type was not yet set: Use FormData, transform data to multipart.
				else {

					var formData = new FormData();
					generateFormDataFromData( requestData.data, formData );

					requestData.data = formData;

					// Prevent angular from serializing our request data – especially for files
					// http://uncorkedstudios.com/blog/multipartformdata-file-upload-with-angularjs
					requestData.transformRequest = angular.identity;

					// Let user set content type: https://groups.google.com/forum/#!topic/angular/MBf8qvBpuVE
					// In case of files, boundary ID is needed; can't be set manually.
					// Content-Type needs only to be set if browser doesn't support FormData
					requestData.headers[ 'Content-Type' ] = undefined;

				}



			}



			// Disable caching
			requestData.cache = false;

			// IE f***ing 9 f****ng cashes all f*****ng get requests
			if( requestData.method === 'get' && navigator && navigator.appVersion && navigator.appVersion.toLowerCase().indexOf("msie 9") > -1 ) {
				requestData.params = requestData.params || {};
				requestData.params._nocache = new Date().getTime() + Math.round( Math.random() * 9999 );
			}


			console.log( 'APIWrapperService: Make $http request with %o', requestData );

			return $http( requestData )
				.then( function( response ) {

					return handleSuccess( response );					

				}, function( response ) {

					// 301 and 302 should not fail, hell!
					var validStatusCodes = [ 301, 302 ];
					if( response && response.status && validStatusCodes.indexOf( response.status ) > -1 ) {
						return handleSuccess( response );
					}


					// Try to get the best description of the error
					var description;

					if( !angular.isString( response.data ) ) {

						if( angular.isObject( response.data ) ) {

							// Names of the fields that might hold the error, least important first
							var fieldNames = [ 'status', 'msg', 'message', 'description' ];
							fieldNames.forEach( function( fieldName ) {
								if( response.data[ fieldName ] ) {
									description = response.data[ fieldName ];
								}
							} );

							if( !description ) {
								description  = JSON.stringify( response.data );
							}

						}

					}
					else {
						description = response.data;
					}

					if( !description ) {
						description = 'HTTP ' + requestData.method.toUpperCase() + ' request to ' + requestData.url + ' failed: ' + response.data + ' (Status ' + response.status + ')';
					}


					function HTTPError( description ) {
						if( Error.captureStackTrace && angular.isFunction( Error.captureStackTrace ) ) {
							Error.captureStackTrace( this );
						}
						this.statusCode = response.status;
						this.message = description;
						this.name = 'HTTPError';
					}
					HTTPError.prototype = Object.create( Error.prototype );

					

					return $q.reject( new HTTPError( description ) );

				
				} );


		}




		function handleSuccess( response ) {

			var ret = response.data;
			response.abort = function() {
				console.error( 'ABORT? :-)' );
			};
			return ret;

		}




	} )();

	/**
	* Service that translates distributed time strings (YYYY-MM-DD HH:MM:SS) into
	* JS dates (with local UTC offset) and converts local dates with UTC offset into 
	* distributed time strings.
	*
	* Needs to stay here: Is used to send HEADERS (!) sometimes.
	*
	*/
	_module.factory( 'APIDateService', [ '$filter', function( $filter ) {

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

} )();