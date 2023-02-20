// Imports
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

// Mongo connection
//mongoDB connection
const mongoose = require('mongoose');
mongoose.set('strictQuery', true);
mongoose.connect(`mongodb+srv://DefaultUser:${process.env.PASSWORD}@cluster0.4qznb9j.mongodb.net/?retryWrites=true&w=majority`, {useNewUrlParser: true, useUnifiedTopology: true});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("Connected to MongoDB!");
});

// Express configs
app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// Mongo schemes
//    User
const UserSchema = new mongoose.Schema({
  username    : String,
  count       : Number,  //number of exercise logs
  log         : [Object]
})
const UserModel = mongoose.model('UserModel', UserSchema);

//    Exercise
const Exercisechema = new mongoose.Schema({
  description : String,
  duration    : Number,
  date        : Date
})
const ExcerciseModel = mongoose.model('ExerciseModel', Exercisechema);

//Purpose: Track excercise
//  Tech: Form -> middleware -> database -> response
//  Stack: Html, node, express, body-parser, mongo/mongoose


// POST request to /api/users creates a user with NAME, _id, and an array of exercie objects (arr starts empty)
app.post('/api/users', (req,res) => {
  // create user
  const userModel = new UserModel({
    username      : req.body.username,
    count         : 0,
    log           : []
  })
  console.log(userModel);
  // save user in db, return json with username and _id
  userModel.save((error, savedDocument) => {
    if (error)
      return res.status(500).send(error)
    res.json(savedDocument)
  })
  // res.json(userModel);
});

// GET request to /api/users returns a list of all users in an array
app.get('/api/users', (req, res) => {
  // return json with all users in an array
  UserModel.find({}, (error, document) => {
    if (error)
      return res.json({ error : 'could not find user list' })
    res.json(document)
  })
});

// POST request to /api/users/:_id/exercises with _id, description, duration, and (optional) date
// creates an exercise for the user and returns the user object with exercises added
app.post('/api/users/:_id/exercises', (req, res) => {
  // create date object for exercise
  const exerciseDate = req.body.date ? new Date(req.body.date) : new Date();
  // create exercise for _id
  const exerciseModel = new ExcerciseModel({
    description : req.body.description,
    duration    : req.body.duration,
    date        : exerciseDate
  })
  // console.log('Date input and object', req.body.date, exerciseDate)
  // console.log(exerciseModel)
  // console.log("Look at my _________id", req.params._id, req.body);

  //aggregate: push to array -> get size of array -> save to db
  UserModel.aggregate(
    [
      { $match  : { _id : mongoose.Types.ObjectId(req.params._id)} },
      { $set    : { log : { $concatArrays: [ '$log', [exerciseModel] ] } } },
      { $set    : { count : { $size : '$log' } } },
      { $merge  : UserModel.collection.name }
    ], (error, doc) => {
      if (error)
        return console.log(error);
      console.log("DB POST complete");
      return true;
    });
  //find id in db and return as json
  UserModel.findById(req.params._id, (error, document) => {
    if (error)
      return res.status(500).json({"findById failed" : error});
    // we want to find the username belonging to the given _id and return it alongside the exercise model
    res.json({
      username    : document["username"],
      description : exerciseModel["description"],
      duration    : exerciseModel["duration"],
      date        : exerciseModel["date"].toDateString(),
      _id         : document["_id"]
    });
  });
});


// GET request to /api/users/:_id/logs returns the id's user, an array containing all the user's logs, and the number of logs in the user's profile
// ?from ?to and ?limit can be used to filter the returned logs
app.get('/api/users/:_id/logs/', (req, res) => {
// app.get('/api/users/:_id/logs/:from?&:to?&:limit?', (req, res) => {
  // find user => sort user.log by optional params => map user.log.date to dateString()

  // Make params work now - use to sanitize url input later
  const FROM  = req.query.from ;
  const TO    = req.query.to   ;
  const LIMIT = req.query.limit;
  /* const FROM  = req.params.from  || null;
  const TO    = req.params.to    || null;
  const LIMIT = req.params.limit || null; */


  UserModel.findById(req.params._id, (error, document) => {
    if (error)
      return res.json({error : 'could not find document'});
    
    // filter UserModel.log by queries
    if(FROM)
      document.log = document.log.filter(item => Date.parse(item.date) >= Date.parse(FROM));
    if(TO)
      document.log = document.log.filter(item => Date.parse(item.date) <= Date.parse(TO));
    if(LIMIT && LIMIT >= 1)
      document.log = document.log.slice(0, LIMIT);
    // convert the log dates to datestrings
    for (let i = 0; i < document.log.length; i++)
      document.log[i].date = document.log[i].date.toDateString();
    
    // document.log = document.log.map(item => item.date = item.date.toDateString())
    
    // console.log("QUERY:-----------------", req.query)
    console.log(document.log);
    res.json(document);
  })


  /* UserModel.aggregate([
    { $match  : { _id : mongoose.Types.ObjectId(req.params._id) } },
    { $set : {  
      "log" : { "$filter" : { 
        "input" : "$log", 
        "as"    : "item", 
        "cond"  : { "$gte" : ["$$item.duration", 900 ] } 
      } }
    } }
    // { $match  : { "log.date" : "Fri Feb 12 1965" } }
    // log -> foreach date(date.toDateString())
  ], (error, document) => {
    if (error)
      return console.error(error);
    // console.log(document);
    console.log("aggregate complete");
    return res.json(document);
  }); */

})


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
