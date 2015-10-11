/**
 * Populate DB with sample data on server start
 * to disable, edit config/environment/index.js, and set `seedDB: false`
 */

'use strict';
var _ = require('lodash');
var moment = require('moment');
var math = require('mathjs');
var Q = require('q');
var log4js = require('log4js');
var logger = log4js.getLogger();
logger.setLevel('TRACE');

var KPI = require('../api/KPI/KPI.model');
var Dashboard = require('../api/dashboard/dashboard.model');
var Task = require('../api/task/task.model');
var Metric = require('../api/metric/metric.model');
var Hierarchies = require('../api/hierarchy/hierarchy.model');
var User = require('../api/user/user.model');

var hierarchyValues = {};
var mTask = {};
var usersList = [];
var dashboards = [];
var mKPI = {};

var tools = require('./tools');

module.exports = {
    fromTask: function(req, callback) {
        //logger.trace("Start getdata.fromTask");
        Q()
            .then(function() {
                // Get a single task
                var deferred = Q.defer();
                if (typeof req.params.id === 'undefined') {
                    Task.find({}, '-__v').sort({
                        date: 'desc'
                    }).lean().exec(function(err, task) {
                        mTask = {
                            _id: null,
                            name: null,
                            context: '',
                            activity: ''
                        };
                        mTask.tasks = task;
                        deferred.resolve(mTask);
                    })
                } else {
                    Task.findById(req.params.id, '-__v').lean().exec(function(err, task) {
                        mTask = {
                            _id: task._id,
                            name: task.name,
                            context: task.context,
                            activity: task.activity
                        };
                        mTask.tasks = [task];
                        deferred.resolve(mTask);
                    })
                }
                return deferred.promise;
            })
            .then(function() {
                // Get a single user
                var deferred = Q.defer();
                User.find({}, '-salt -hashedPassword', function(err, user) {
                    usersList = user;
                    deferred.resolve(usersList);
                })
                return deferred.promise;
            })
            .then(function() {
                // Get a single user
                var deferred = Q.defer();
                Dashboard.find({}, '-__v', function(err, dashboard) {
                    dashboards = dashboard;
                    deferred.resolve(dashboards);
                })
                return deferred.promise;
            })
            .then(function() {
                // Get a single hierarchy
                var deferred = Q.defer();
                Hierarchies.find({
                    name: 'Task'
                }, '-__v', function(err, hierarchy) {
                    hierarchyValues = hierarchy[0].list;
                    deferred.resolve(hierarchy);
                })
                return deferred.promise;
            })
            .then(function() {
                // Get all kpis
                var deferred = Q.defer();
                KPI.find({}, '-__v').lean().exec(function(err, mKPI) {
                    mTask.kpis = mKPI;
                    deferred.resolve(mKPI);
                })
                return deferred.promise;
            })
            .then(function() {
                //logger.trace("Start metrics");
                // Get related metrics
                var deferred = Q.defer();
                Metric.find({}, '-__v').sort({
                    date: 'asc'
                }).lean().exec(function(err, metric) {
                    _.each(metric, function(metricdata, index) { // pour chaque metric
                        _.each(mTask.tasks, function(taskdata, index) { // pour chaque tache

                            // si c'est la première métric, on crèe l'objet
                            if (typeof taskdata.metrics === 'undefined') {
                                taskdata.metrics = []
                            }

                            // si la metrique est attaché à la tache
                            if (metricdata.context === taskdata.context && metricdata.activity === taskdata.activity) {

                                // ajouter calcul auto
                                metricdata.taskname = taskdata.name;

                                // nombre de jours séparant la date de début, fin, entre les deux
                                metricdata.duration = moment(metricdata.endDate).diff(metricdata.startDate, 'days');
                                metricdata.timeToBegin = moment(metricdata.startDate).diff(moment(), 'days');
                                metricdata.timeToEnd = moment(metricdata.endDate).diff(moment(), 'days');

                                // predictedCharge
                                metricdata.projectedWorkload = (metricdata.progress > 0) ? Math.round(1000 * parseFloat(metricdata.timeSpent.replace(',', '.')) * 100 / parseFloat(metricdata.progress)) / 1000 : metricdata.load;

                                // progressStatus
                                if (metricdata.endDate > taskdata.endDate) {
                                    switch (metricdata.status) {
                                        case 'Withdrawn':
                                        case 'Finished':
                                            metricdata.progressStatus = 'Late';
                                            break;
                                        default:
                                            var d2 = new Date();
                                            var dateNow = d2.toISOString();
                                            if (dateNow < metricdata.endDate) {
                                                metricdata.progressStatus = 'At Risk';
                                            } else {
                                                metricdata.progressStatus = 'Late';
                                            }
                                    }
                                } else {
                                    metricdata.progressStatus = 'On Time';
                                }
                                // ajouter information par mois 
                                metricdata.groupTimeByValue = moment(metricdata.date).format("YYYY.MM");

                                //on l'ajoute à la liste
                                taskdata.metrics.push(metricdata);

                                // kpis 
                                _.each(mTask.kpis, function(kpidata, index) {

                                    // on calcule le time to wait par rapport aux KPIs
                                    if (taskdata.context.indexOf(kpidata.context) >= 0 && taskdata.activity.indexOf(kpidata.activity) >= 0) {
                                        taskdata.timetowait = Math.min((typeof kpidata.refresh === 'undefined') ? Infinity : kpidata.refresh, (typeof taskdata.timetowait === 'undefined') ? Infinity : taskdata.timetowait);
                                    }

                                    // ajout des couleurs
                                    if (typeof metricdata[kpidata.metricTaskField] === 'string') {
                                        var Value = _.filter(hierarchyValues, function(item) {
                                            return kpidata.metricTaskField && item.text.toLowerCase() === metricdata[kpidata.metricTaskField].toLowerCase();
                                        });
                                        if (Value.length > 0) {
                                            metricdata.color = Value[0].color;
                                            metricdata.value = Value[0].value;
                                            metricdata.description = Value[0].description;
                                        }
                                    }
                                });

                                // on calcule les temps d'écarts
                                var oneDay = 24 * 60 * 60 * 1000;
                                var d = new Date(taskdata.startDate);
                                var dateStart = d.setDate(d.getDate() - taskdata.timetowait);
                                var firstDate = (metricdata.date > taskdata.startDate) ? new Date(metricdata.date) : new Date(dateStart);
                                var secondDate = new Date();
                                taskdata.secondDate = secondDate;
                                taskdata.timewaited = Math.round((firstDate.getTime() - secondDate.getTime()) / (oneDay));
                                taskdata.timebetween = (metricdata.status === 'In Progress' || metricdata.status === 'Not Started') ? taskdata.timetowait + taskdata.timewaited : null;
                                metricdata.fromNow = moment(metricdata.date).fromNow();
                                taskdata.lastmetric = metricdata;


                            }
                        });
                    });
                    deferred.resolve(mTask);
                })
                return deferred.promise;
            })
            .then(function() {
                //logger.trace("Start Calculer les KPI par taches");
                // Calculer les KPI par taches
                var deferred = Q.defer();

                // pour chaque tache
                _.each(mTask.tasks, function(taskdata, index) {
                    taskdata.kpis = [];
                    // kpis 
                    _.each(mTask.kpis, function(kpidata, index) {
                        taskdata.kpis[index] = {};
                        var mKPI = taskdata.kpis[index];

                        // on ajoute des caractéristiques aux KPI
                        //##############################################
                        mKPI.metricsGroupBy = {};
                        mKPI.calcul = {};
                        mKPI.metricsGroupBy.Time = tools.groupMultiBy(taskdata.metrics, ['groupTimeByValue']);
                        var filteredMetrics = _.filter(taskdata.metrics, function(metric) {
                            return (mKPI.category === 'Alert') ? metric.groupTimeByValue === moment(new Date()).format("YYYY.MM") : _.last(metric.groupTimeByValue); //filtrer par le mois en cours
                        });
                        mKPI.calcul.task = tools.calculKPI(filteredMetrics, kpidata);
                        mKPI.calcul.taskTime = _.map(mKPI.metricsGroupBy.Time, function(value, key) {
                            return {
                                month: key,
                                valueKPI: tools.calculKPI(value, kpidata)
                            };
                        });

                    });

                });
                deferred.resolve(mTask);
                return deferred.promise;
            })
            .then(function() {
                // Calculer les KPI par taches
                var deferred = Q.defer();

                // pour chaque tache
                _.each(mTask.tasks, function(taskdata, index) {
                    var actorsObject = _.countBy(taskdata.metrics, function(metric) {
                        return metric.actor._id;
                    });
                    taskdata.actors = _.map(actorsObject, function(value, key) {
                        return {
                            _id: key,
                            count: value,
                            name: _.pluck(_.filter(usersList, function(user) {
                                return (key === user._id.toString())
                            }), 'name').toString()
                        };
                    });
                    taskdata.watchers = _.map(taskdata.watchers, function(value, key) {
                        return {
                            _id: value,
                            count: 1,
                            name: _.pluck(_.filter(usersList, function(user) {
                                return (value === user._id.toString())
                            }), 'name').toString()
                        };
                    });
                });
                deferred.resolve(mTask);
                return deferred.promise;
            })
            .then(function() {
                // Get related dashboards // A revoir car ne marche pas avec plusieurs taches
                var deferred = Q.defer();
                // pour chaque tache
                _.each(mTask.tasks, function(taskdata, index) {
                    taskdata.dashboards = [];
                    _.each(dashboards, function(dashboarddata, index) {
                        if (typeof dashboarddata.context === 'undefined' || dashboarddata.context === '') {
                            dashboarddata.context = taskdata.context
                        }
                        if (typeof dashboarddata.activity === 'undefined' || dashboarddata.activity === '') {
                            dashboarddata.activity = taskdata.activity
                        }
                        if (typeof dashboarddata.context === 'undefined' || taskdata.context.indexOf(dashboarddata.context) >= 0 && typeof dashboarddata.activity === 'undefined' || taskdata.activity.indexOf(dashboarddata.activity) >= 0) {
                            if (typeof taskdata.dashboards !== 'undefined') {
                                taskdata.dashboards.push(dashboarddata.toObject());
                            }
                        }
                    });

                });
                deferred.resolve(mTask);
                return deferred.promise;
            })
            .then(function() {
                callback(mTask);
            })
            .then(null, console.error);
    },
    addCalculToKPI: function(kpis, tasks, callback) {

        // on ajoute des caractéristiques aux KPI
        //##############################################
        _.each(kpis, function(kpi, index) {
            kpi.calcul = {};
            kpi.calcul.details = _.pluck(tasks, function(task) {
                return task.kpis[index].calcul;
            });

            // calcul par tache
            var kpicalculValues = _.filter(_.pluck(kpi.calcul.details, function(calcul) {
                return calcul.task;
            }), function(data) {
                return !isNaN(parseInt(data));
            });
            var sum = _.reduce(kpicalculValues, function(sum, kpicalcul) { // sum
                return sum + kpicalcul;
            });
            kpi.calcul.task = (kpi.category === 'Alert') ? sum : parseInt(sum / kpicalculValues.length);

            // calcul par tache et temps
            kpicalculValues = _.filter(_.pluck(kpi.calcul.details, function(calcul) {
                return calcul.taskTime;
            }), function(data) {
                return (data[0]) ? !isNaN(parseInt(data[0].valueKPI)) : true;
            });
            var kpiValuesByMonth = _.groupBy(_.flatten(kpicalculValues), function(data) {
                return data.month;
            });
            kpi.calcul.taskTime = _.map(kpiValuesByMonth, function(data) {
                sum = _.reduce(_.pluck(data, 'valueKPI'), function(sum, kpicalcul) { // sum
                    return sum + kpicalcul;
                });
                var number = _.pluck(_.pick(_.pluck(data, 'valueKPI'), _.isNumber)).length;
                return {
                    month: data[0].month,
                    sum: sum,
                    number: number,
                    value: (kpi.category === 'Alert') ? sum : (number === 0) ? null : parseInt(sum / number)
                };
            });

        });
        callback(kpis);
    },
    KPIById: function(req, callback) {

        Q()
            .then(function() {
                // Get a single kpi
                var deferred = Q.defer();
                KPI.findById(req.params.id, function(err, kpi) {
                    mKPI = kpi.toObject();
                    if (typeof mKPI.context === 'undefined' || mKPI.context === '') {
                        mKPI.context = (typeof req.query.context === 'undefined') ? '' : req.query.context;
                        mKPI.originalContext = ''
                    }
                    if (typeof mKPI.activity === 'undefined' || mKPI.activity === '') {
                        mKPI.activity = (typeof req.query.activity === 'undefined') ? '' : req.query.activity;
                        mKPI.originalActivity = ''
                    }
                    deferred.resolve(mKPI);
                })
                return deferred.promise;
            })
            .then(function() {
                // Get a single hierarchy
                var deferred = Q.defer();
                Hierarchies.find({
                    name: 'Task'
                }, function(err, hierarchy) {
                    hierarchyValues = hierarchy[0].list;
                    deferred.resolve(mKPI);
                })
                return deferred.promise;
            })
            .then(function() {
                // Get related dashboards
                var deferred = Q.defer();
                mKPI.dashboards = [];
                Dashboard.find({}, function(err, dashboard) {
                    _.each(dashboard, function(rowdata, index) {
                        if (typeof rowdata.context === 'undefined' || rowdata.context === '') {
                            rowdata.context = mKPI.context
                        }
                        if (typeof rowdata.activity === 'undefined' || rowdata.activity === '') {
                            rowdata.activity = mKPI.activity
                        }
                        if (mKPI.dashboards && mKPI.context.indexOf(rowdata.context) >= 0 && mKPI.activity.indexOf(rowdata.activity) >= 0) {
                            mKPI.dashboards.push(rowdata.toObject());
                        }
                    });
                    deferred.resolve(mKPI);
                })
                return deferred.promise;
            })
            .then(function() {
                // Get related Tasks
                var deferred = Q.defer();
                mKPI.tasks = [];
                Task.find({}, function(err, task) {
                    _.each(task, function(rowdata, index) {
                        if (mKPI.tasks && rowdata.context.indexOf(mKPI.context) >= 0 && rowdata.activity.indexOf(mKPI.activity) >= 0) {
                            mKPI.tasks.push(rowdata.toObject());
                        }
                    });
                    deferred.resolve(mKPI);
                })
                return deferred.promise;
            })
            .then(function() {
                // Get related metrics
                var deferred = Q.defer();
                mKPI.metrics = [];
                Metric.find({}, function(err, metric) {
                    _.each(metric, function(rowdata, index) {
                        if (mKPI.metrics && rowdata.context.indexOf(mKPI.context) >= 0 && rowdata.activity.indexOf(mKPI.activity) >= 0) {
                            mKPI.metrics.push(rowdata.toObject());
                        }
                    });
                    deferred.resolve(mKPI);
                })
                return deferred.promise;
            })
            .then(function() {
                var deferred = Q.defer();

                // ajouter les propriétés des métriques
                //##############################################  
                _.each(mKPI.metrics, function(metric) {

                    // ajouter calcul auto
                    // nombre de jours séparant la date de début, fin, entre les deux
                    metric.duration = moment(metric.endDate).diff(metric.startDate, 'days');
                    metric.timeToBegin = moment(metric.startDate).diff(moment(), 'days');
                    metric.timeToEnd = moment(metric.endDate).diff(moment(), 'days');

                    // predictedCharge
                    metric.projectedWorkload = (metric.progress > 0) ? parseInt(parseInt(metric.timeSpent) * 100 / parseInt(metric.progress)) : metric.load;

                    // ajouter information par mois 
                    metric.groupTimeByValue = moment(metric.date).format("YYYY.MM");

                    //metric.taskname = []; à vérifier qu'il n'y est qu'une tache avec le meme context, activity
                    _.forEach(mKPI.tasks, function(task) {
                        if (metric.context === task.context && metric.activity === task.activity) {
                            metric.taskname = task.name;
                        }
                    });

                    // ajout des couleurs
                    if (typeof metric[mKPI.metricTaskField] === 'string') {
                        var Value = _.filter(hierarchyValues, function(item) {
                            return mKPI.metricTaskField && item.text.toLowerCase() === metric[mKPI.metricTaskField].toLowerCase();
                        });
                        if (Value.length > 0) {
                            metric.color = Value[0].color;
                            metric.value = Value[0].value;
                            metric.description = Value[0].description;
                        }
                    }
                });

                // on ajoute des caractéristiques aux KPI
                //##############################################
                module.exports.addCalculToKPI(mKPI);

                deferred.resolve(mKPI);
                return deferred.promise;
            })
            .then(function() {
                callback(mKPI);
            })
            .then(null, console.error);
    },
    addCalculToKPI2: function(mKPI) {
        // on ajoute des caractéristiques aux KPI
        //##############################################
        mKPI.metricsGroupBy = {};
        mKPI.metricsGroupBy.Task = tools.groupMultiBy(mKPI.metrics, ['taskname']);
        mKPI.metricsGroupBy.TaskTime = tools.groupMultiBy(mKPI.metrics, ['taskname', 'groupTimeByValue']);
        mKPI.metricsGroupBy.Field = tools.groupMultiBy(mKPI.metrics, [mKPI.metricTaskField]);
        mKPI.metricsGroupBy.FieldTime = tools.groupMultiBy(mKPI.metrics, [mKPI.metricTaskField, 'groupTimeByValue']);
        mKPI.metricsGroupBy.Time = tools.groupMultiBy(mKPI.metrics, ['groupTimeByValue']);


        // a changer pour les bars
        mKPI.metricsGroupBy.oldTime = tools.groupByTime(tools.groupMultiBy(mKPI.metrics, ['groupTimeByValue', 'taskname']), 'date', mKPI.metricTaskField);

        mKPI.calcul = {};
        mKPI.calcul.time = _.map(mKPI.metricsGroupBy.Time, function(value, key) {
            return {
                month: key,
                valueKPI: tools.calculKPI(value, mKPI)
            };
        });
        mKPI.calcul.task = _.map(mKPI.metricsGroupBy.Task, function(value, key) {
            return {
                task: key,
                valueKPI: tools.calculKPI(value, mKPI)
            };
        });
        mKPI.calcul.taskTime = _.map(mKPI.metricsGroupBy.TaskTime, function(value, key) {
            return {
                task: key,
                time: _.map(value, function(value2, key2) {
                    return {
                        month: key2,
                        valueKPI: tools.calculKPI(value2, mKPI)
                    };
                })
            };
        });

        // la liste des acteurs
        mKPI.actors = _.map(_.countBy(mKPI.metrics, 'actor'), function(value, key) {
            return {
                name: key,
                count: value
            };
        });

        // graphics
        mKPI.graphs = [];

        var myChart0 = tools.buildChart(mKPI, 'hBullet');
        var myChart1 = tools.buildChart(mKPI, 'Bar');
        var myChart2 = tools.buildChart(mKPI, 'Bubble');
        mKPI.graphs.push(myChart0);
        mKPI.graphs.push(myChart1);
        mKPI.graphs.push(myChart2);

    },
    shrinkPerimeterOfKPI: function(kpi, perimeter) {
        //shrink metrics
        var metrics = kpi.metrics;
        delete kpi.metrics;
        kpi.metrics = _.filter(metrics, function(rowdata) {
            return (rowdata.context.indexOf(perimeter.context) >= 0) && (rowdata.activity.indexOf(perimeter.activity) >= 0);
        });

        //reinit kpi
        kpi.metricsGroupBy = {};
        kpi.metricsGroupBy = {};
        kpi.graphs = {};

        // recalcul kpi
        module.exports.addCalculToKPI(kpi);

        return kpi;
    }
};