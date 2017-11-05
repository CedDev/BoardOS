'use strict';

angular.module('boardOsApp')
  .controller('ImportCtrl', function($scope, $http, socket, $interval) {


            $scope.allitems = [];


            $scope.uploadXmlFile = function() {
                var file = document.getElementById('importFile').files[0],
                    reader = new FileReader();
                reader.readAsBinaryString(file);
                reader.onloadend = function(e) {
                    var x2js = new X2JS();
                    var aftCnv = x2js.xml_str2json(e.target.result);

                    var item = aftCnv.rss.channel.item;

                    _.each(item, function(e) {
                        e['title'] = e.title.substr(e.title.indexOf(']') + 2);
                        if (e.title.indexOf('#') !== -1) { e['contexte'] = e.title.substring(e.title.indexOf('#'), e.title.indexOf(' ')); }
                        e.custom = e.customfields.customfield;

                        e.start =new Date(e.created).toISOString();
                        if(e.resolved){e.end =new Date(e.resolved).toISOString();}


                    });

                    //filter only subtasks not present in boss
                    $scope.allitems = _.filter(item, function(r) {
                        return _.isEmpty(r.parent) === false;
                    });

                  console.log($scope.allitems);

                };

            };


  });
