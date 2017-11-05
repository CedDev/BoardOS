'use strict';

angular.module('boardOsApp')
    .config(function($stateProvider) {
        $stateProvider
            .state('import', {
                url: '/import',
                templateUrl: 'app/import/import.html',
                controller: 'ImportCtrl',
                authenticate: true
            });
    });
