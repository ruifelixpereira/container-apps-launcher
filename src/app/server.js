var express = require('express');
var handlebars  = require('express-handlebars');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser')
var request = require('request');
var os = require("os");
var morgan  = require('morgan');

// Set up express
var app = express();
app.use(cookieParser());
app.engine('handlebars', handlebars.engine({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');
app.use(express.static('static'));
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(morgan('combined'));

// Configuration and potential overrides
var port = process.env.PORT || 8080;
var title = process.env.TITLE || "Piccolo Agents Launcher";
var instancesLabel = process.env.INSTANCESVALUE || "Instances";
var instancesCount = 1;
var showDetails = process.env.SHOWDETAILS || false;
var featureFlag = process.env.FEATUREFLAG || false;
var redisHost = process.env.REDIS_HOST || "capps-launcher-storage";
var redisPort = process.env.REDIS_PORT || 6379;
var analyticsHost = process.env.ANALYTICS_HOST || "capps-launcher-analytics";
var analyticsPort = process.env.ANALYTICS_PORT || 8080;

// Set up redis
const redis = require('redis');
const { log } = require('console');
const redisClient = redis.createClient({ url: 'redis://' + redisHost + ':' + redisPort })
  .on('error', err => console.log('Redis Client Error', err))
  .on('connect', msg => console.log('Connected to Redis.'));
const start = async () => { await redisClient.connect(); };
start();

function propagateTracingHeaders(req) {
  var headers = {};
  var tracingHeaders = [
    'x-request-id',
    'x-b3-traceid',
    'x-b3-spanid',
    'x-b3-parentspanid',
    'x-b3-sampled',
    'x-b3-flags',
    'x-ot-span-context'
  ];

  for (let header of tracingHeaders) {
    value = req.get(header);
    if (value != undefined) {
      headers[header] = value;
    }
  }
  return headers;
}

// Set up voting-analytics url
var analyticsServerUrl = 'http://' + analyticsHost + ':' + analyticsPort + '/analytics'

// GET - display vote form and analytics
app.get('/', function (req, res) {

  var isFeatureFlagSet = false;
  if (req.cookies && req.cookies.featureflag) {
    isFeatureFlagSet = true;
  }

  request.get( { headers: propagateTracingHeaders(req), url: analyticsServerUrl, json: true }, (analyticsError, analyticsResponse, analyticsBody) => {
    if (analyticsError) { return console.log(analyticsError); }
    var analytics = analyticsBody.text;
    
    res.render('capps', {
      featureFlag: {
        isEnabled: String(featureFlag) == "true",
        isSet: isFeatureFlagSet
      },
      title: title,
      instancesLabel: instancesLabel,
      instancesCount: instancesCount,
      analytics: analytics,
      showDetails: { 
        isEnabled: String(showDetails) == "true",
        hostName: os.hostname()
      }
    });
  });

});

// POST - add a new vote, then render vote form and analytics
app.post('/', async (req, res) => {

  var instances = req.body[instancesLabel];
  instancesCount = parseInt(instances) || 0;

  await redisClient.set(instancesLabel, instancesCount);

  res.redirect('/');
});

// POST - set or clear feature flag
app.post('/featureflag/:action(set|clear)', function (req, res) {
  var action = req.params.action;

  if (action === 'set') {
    res.cookie('featureflag', 'on', { expires: new Date(Date.now() + 900000), path: '/' });
  } else {
    res.clearCookie('featureflag', { expires: new Date(Date.now() + 900000), path: '/' });
  }
 
  res.redirect('/');
});

// Set up listener
app.listen(port, function () {
  console.log("Listening on: http://%s:%s", os.hostname(), port);
})
