var express = require('express');
var handlebars  = require('express-handlebars');
var bodyParser = require('body-parser');
var os = require("os");
var morgan  = require('morgan');

// Set up express
var app = express();
app.engine('handlebars', handlebars.engine({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');
app.use(express.static('static'));
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(morgan('combined'));

// Configuration and potential overrides
var port = process.env.PORT || 8080;
var instancesLabel = process.env.INSTANCESVALUE || "Instances";
var redisHost = process.env.REDIS_HOST || "capps-launcher-storage";
var redisPort = process.env.REDIS_PORT || 6379;

// Set up redis
const redis = require('redis');
const redisClient = redis.createClient({ url: 'redis://' + redisHost + ':' + redisPort })
  .on('error', err => console.log('Redis Client Error', err))
  .on('connect', msg => console.log('Connected to Redis.'));
const start = async () => { await redisClient.connect(); };
start();

// GET - display vote form and analytics
app.get('/analytics', async (req, res) => {

  instancesCount = parseInt(await redisClient.get(instancesLabel)) || 0;
  var text = instancesLabel + ': ' + instancesCount;

  res.json({
    "category1": {
      "name": instancesLabel,
      "count": instancesCount
    },
    "text": text
  });
});

// Set up listener
app.listen(port, function () {
  console.log("Listening on: http://%s:%s", os.hostname(), port);
})

