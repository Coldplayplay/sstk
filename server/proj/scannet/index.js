// Express subapp
var express = require('express');
var path = require('path');
var config = require('../../config');

var app = module.exports = express();

app.use(express.static(path.join(__dirname, './static/html/')));
app.use(express.static(path.join(__dirname, './static/')));

// set views for scannet
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

// Hookup to annotations
var SQLAnnotationDb = require('../../app/sqlAnnotationDb');
var annDb = new SQLAnnotationDb(config.annDb);

// ScanNet annotation summary views
app.get('/nyuv2', function (req, res) { res.render('nyuv2-annotations'); });
app.get('/nyuv2-parts', function (req, res) { res.render('nyuv2-part-annotations'); });
app.get('/my_asset', function (req, res) { res.render('my_asset-annotations', { baseUrl: config.baseUrl }); });

// ScanNet (official anonymized)
app.get('/scannet/grouped', function (req, res) {
  if (req.query['annotate']) {
    res.render('grouped-annotator');
  } else {
    res.render('grouped-viewer');
  }
});
app.get('/scannet/querier', function (req, res) { res.render('scan-querier'); });

// Scan viewer
app.get('/', function (req, res) { res.render('scan-viewer'); });
app.get('/viewer', function (req, res) { res.render('scan-viewer'); });
app.get('/simple-viewer', function (req, res) { res.render('scan-viewer-simple'); });
app.get('/scan-model-aligner', function (req, res) {
  res.render('scan-model-aligner', { modelsAnnotated: 0, totalToAnnotate: 3 });
});
app.get('/scan-annotator', function (req, res) { res.render('scan-annotator'); });
app.get('/scan-completer', function (req, res) { res.render('scan-completer'); });
app.get('/house-viewer', function (req, res) { res.render('house-viewer'); });

// Semantic segmentation annotation
var SegmentAnnotatorServer = require('./segmentAnnotatorServer');
var segmentAnnotatorServer = new SegmentAnnotatorServer({ sqlDB: annDb, app: app, config: config });
app.get('/segment-annotator-instructions',
  segmentAnnotatorServer.populateUserState.bind(segmentAnnotatorServer),
  segmentAnnotatorServer.annotatorInstructions.bind(segmentAnnotatorServer));
app.get('/segment-annotator',
  segmentAnnotatorServer.populateUserState.bind(segmentAnnotatorServer),
  segmentAnnotatorServer.annotatorHandler.bind(segmentAnnotatorServer));
app.get('/segment-annotator-single',
  segmentAnnotatorServer.populateUserState.bind(segmentAnnotatorServer),
  segmentAnnotatorServer.annotateSingle.bind(segmentAnnotatorServer));
app.get('/instance-annotator',
  segmentAnnotatorServer.populateUserState.bind(segmentAnnotatorServer),
  function(req, res, next) { res.locals.view = 'instance-annotator'; next(); },
  segmentAnnotatorServer.annotateSingle.bind(segmentAnnotatorServer));
app.get('/part-annotator',
  segmentAnnotatorServer.populateUserState.bind(segmentAnnotatorServer),
  segmentAnnotatorServer.populateSegmentAnnotation.bind(segmentAnnotatorServer),
  function(req, res, next) { res.locals.view = 'part-annotator'; next(); },
  segmentAnnotatorServer.annotateSingle.bind(segmentAnnotatorServer));


// Listing segment annotations
app.get('/segment-annotations', function (req, res) { res.render('segment-annotations'); });
app.get('/segment-annotations/list',
  function(req, res, next) {
    res.locals.defaults = { ajax: true }; // Use ajax to render view
    next();
  },
  segmentAnnotatorServer.listAnnotations.bind(segmentAnnotatorServer)
);
app.post('/segment-annotations/edit', segmentAnnotatorServer.editSegmentAnnotations.bind(segmentAnnotatorServer));
app.get('/segment-annotations/aggregated', segmentAnnotatorServer.getAggregatedAnnotations.bind(segmentAnnotatorServer));
app.get('/segment-annotations/view', segmentAnnotatorServer.getViewer.bind(segmentAnnotatorServer));
app.post('/segment-annotations/submit', segmentAnnotatorServer.submitAnnotations.bind(segmentAnnotatorServer));

// Listing instance annotations
app.get('/instance-annotations/list',
  function(req, res, next) {
    res.locals.defaults = { '$showAnnParts': true, 'labelType': 'category', 'ajax': false }; // Use ajax to render view and list annotation parts
    res.locals.view = 'instance-annotations';
    next();
  },
  segmentAnnotatorServer.listAnnotations.bind(segmentAnnotatorServer)
);
app.get('/part-annotations/list',
  function(req, res, next) {
    res.locals.defaults = { 'task': 'part_annotation', 'labelType': 'part', 'ajax': true }; // Use ajax to render view and list annotation parts
    next();
  },
  segmentAnnotatorServer.listAnnotations.bind(segmentAnnotatorServer)
);

// TODO: this is a bit more general than just the segmentAnnotatorServer
app.post('/annotations/edit', segmentAnnotatorServer.editAnnotations.bind(segmentAnnotatorServer));

var _ = require('lodash');
app.get('/annotations/list', function (req, res) {
  var sqlDB = annDb;

  var queryParams = _.defaults({}, req.body, req.query);
  var format = queryParams.format;
  if (format === 'json') {
    // Query general annotations table for a summary of segment annotations
    sqlDB.queryAnnotations(queryParams, res, function (rows) {
      rows = sqlDB.convertAnnotationRecords(rows);
      res.json(rows);
    });
  } else {
    // TODO: create generic annotations view
    //var view = (queryParams.task === 'scan-model-align')? 'scan-model-alignments' : 'annotations';
    var view = 'scan-model-alignments';
    res.render(view, {
      ajaxOptions:  {
        url: config.baseUrl + app.mountpath + req.path + '?format=json',
        groupBy: queryParams['$groupBy'],
        data: queryParams,
        dataSrc: ''
      }
    });
  }
});
