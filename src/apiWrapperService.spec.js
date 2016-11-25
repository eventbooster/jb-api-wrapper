describe('jb.apiWrapper', function() {
    var initializeProvider = function() {

            var _mod = angular.module('APIWrapperServiceProviderTestModule', []);

            _mod.config(['APIWrapperServiceProvider', function(theProvider) {
                provider = theProvider;
            }]);
            // load the modules
            module('jb.apiWrapper', 'APIWrapperServiceProviderTestModule');
            // trigger the injection
            inject(function() {});

        }
        , provider;

    beforeEach(initializeProvider);

    describe('APIWrapperService', function() {
        var   service = null
            , endpoint = '/test'
            , initializeService = function(){
                inject(['APIWrapperService', function(theService){
                    service = theService;
                }]);
            }
            , $httpBackend
            , $timeout
            , $http
            , accessCounts = {};


        beforeEach(inject(['$timeout', '$httpBackend', '$http', function(timeout, mockHTTP, _$http_){
            $httpBackend    = mockHTTP;
            $timeout        = timeout;
            $http           = _$http_;
            ['options', 'put', 'post', 'patch', 'get', 'delete'].forEach(function(method){
                var uppercaseMethod = method.toUpperCase();
                accessCounts[uppercaseMethod] = 0;
                $httpBackend.when(uppercaseMethod, endpoint).respond(function(method, url, data, headers, params){
                    accessCounts[method]++;
                    return [200, {}];
                });
            });
        }]));

        /**
         * Make afterEach "asynchronous", otherwise, angular will run into digest problems because flush on the
         * $httpBackend as well as the verifyNoOutstandingExpectation method trigger a new digest.
         *
         * If the response of the api is synchronous (as it is when using the $httpBackend as we do in this example)
         * two digests are triggered and interleave. Therefore we postpone the after each procedures to the next
         * digest using the $timeout service. It would probably be better to wrap the done callback, but I don't feel
         * like taking care of this every time.
         *
         * https://docs.angularjs.org/error/$rootScope/inprog?p0=$digest
         * http://stackoverflow.com/questions/24341544/getting-digest-already-in-progress-in-async-test-with-jasmine-2-0
         */
        afterEach(inject(['$timeout', function($timeout){
            $timeout(function(){
                $httpBackend.verifyNoOutstandingExpectation();
                $httpBackend.verifyNoOutstandingRequest();
            }, 0);
        }]));

        it('should be defined', function(){
            initializeService();
            expect(service).not.toBeNull();
        });

        it('should take the given options formatter', function(){
            var formatter = {};
            provider.setOptionsFormatter(formatter);
            initializeService();
            expect(service.optionsFormatter).toBe(formatter);
        });

        it('should make a get request using the given utility method', function(){
            $httpBackend.expectGET(endpoint);
            initializeService();
            service.get(endpoint);
            $httpBackend.flush();
        });

        it('should make a put request using the given utility method', function(){
            $httpBackend.expectPUT(endpoint);
            initializeService();
            service.put(endpoint);
            $httpBackend.flush();
        });

        it('should make a patch request using the given utility method', function(){
            $httpBackend.expectPATCH(endpoint);
            initializeService();
            service.patch(endpoint);
            $httpBackend.flush();
        });

        it('should make a delete request using the given utility method', function(){
            $httpBackend.expectDELETE(endpoint);
            initializeService();
            service.delete(endpoint);
            $httpBackend.flush();
        });

        it('should make a options request using the given utility method', function(){
            $httpBackend.expect('OPTIONS', endpoint);
            initializeService();
            service.options(endpoint);
            $httpBackend.flush();
        });

        it('should take the options formatter into account if present', function(done){
            $httpBackend.expect('OPTIONS', endpoint);
            // set a formatter in the config phase on the provider
            provider.setOptionsFormatter({
                format: function(response){
                    response.name = 'success';
                    return response;
                }
            });
            // initialize the current service
            initializeService();
            // as soon as we get the result the changes to the response should be made
            service.getOptions(endpoint).then(function(result){
                expect(result.name).toEqual('success');
                done();
            }, done.fail);
            $httpBackend.flush();
        });

        it('should take the options from cache if not disabled', function(done){

            var   counter = 0
                , callback = function(result) {
                      if (++counter == 2) {
                          expect(accessCounts['OPTIONS']).toBe(1);
                          done();
                      }
                  };

            $httpBackend.expect('OPTIONS', endpoint);
            //spyOn($httBackend);
            // initialize the current service
            initializeService();
            service.getOptions(endpoint).then(callback, done.fail);
            service.getOptions(endpoint).then(callback, done.fail);
            $httpBackend.flush();
        });

        it('should load the options multiple times if the service is told to disable the cache', function(done){

            var   counter = 0
                , callback = function(result) {
                      if (++counter == 3) {
                          //expect($httpBackend)
                          expect(accessCounts['OPTIONS']).toBe(3);
                          done();
                      }
                  };

            $httpBackend.expect('OPTIONS', endpoint);
            initializeService();
            service.disableCache();
            service.getOptions(endpoint).then(callback, done.fail);
            service.getOptions(endpoint).then(callback, done.fail);
            service.getOptions(endpoint).then(callback, done.fail);
            $httpBackend.flush();
        });

        it('should refresh the cache if told so', function(done){

            var   counter = 0
                , callback = function(result) {
                      if (++counter == 3) {
                          expect(accessCounts['OPTIONS']).toBe(2);
                          done();
                      }
                  };

            $httpBackend.expect('OPTIONS', endpoint);
            // initialize the current service
            initializeService();
            service.getOptions(endpoint, true).then(callback, done.fail);
            service.getOptions(endpoint).then(callback, done.fail);
            service.getOptions(endpoint, true).then(callback, done.fail);
            $httpBackend.flush();
        });

        it('should invalidate the whole cache if told so', function(done){

            var   counter = 0
                , callback = function(result) {
                      if (++counter == 3) {
                          expect(accessCounts['OPTIONS']).toBe(2);
                          done();
                      }
                  };

            $httpBackend.expect('OPTIONS', endpoint);
            // initialize the current service
            initializeService();
            service.getOptions(endpoint).then(callback, done.fail);
            service.getOptions(endpoint).then(callback, done.fail);
            service.invalidateOptionsCache();
            service.getOptions(endpoint).then(callback, done.fail);
            $httpBackend.flush();
        });
    });
    // @see: http://stackoverflow.com/questions/14771810/how-to-test-angularjs-custom-provider
    describe('APIWrapperServiceProvider', function() {
        it('should be defined', function() {
            expect(provider).not.toBeNull();
        });

        it('should expose methods to set default headers', function() {
            expect(provider.setDefaultHeaders).toBeFunction();
            expect(provider.setDefaultHeader).toBeFunction();
        });

        it('should expose methods to set and get a formatter for the options call', function() {
            var formatter = {};
            expect(provider.getOptionsFormatter).toBeFunction();
            expect(provider.setOptionsFormatter).toBeFunction();

            provider.setOptionsFormatter(formatter);
            expect(provider.getOptionsFormatter()).toBe(formatter);
        });
    });
});