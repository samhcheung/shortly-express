var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
  name: 'server-session-cookie-id',
  secret: 'my express secret',
  saveUninitialized: false,
  resave: false
}));


var restrict = function(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}; 



app.get('/', restrict,
function(req, res) {
  console.log('You made it');
  res.render('index');
});

app.get('/create', restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', restrict,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    var userId = null;
    new User({username: req.session.user}).fetch().then(function(found) {
      if (found) {
        userId = found.get('id');
        var selectedUrls = [];
        //console.log('sam', links.models);
        for (var i = 0; i < links.models.length; i++) {
          if (links.models[i].get('userId') === userId) {
            selectedUrls.push(links.models[i]);  
          }
        }
        console.log(req.session.user);

        res.status(200).send(selectedUrls);
      } else {
        console.log('should be empty list');
        res.status(200).send(links.models);
      }
    });
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;
  var userId = null;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }
  new User({ username: req.session.user}).fetch().then(function (found) {
    if (found) {
      console.log('username id inside post links', found.get('id'));
      userId = found.get('id');
    } else {
      console.log('should always find username');
    }

    new Link({ url: uri, userId: userId }).fetch().then(function(found) {
      if (found) {
        res.status(200).send(found.attributes);
      } else {
        util.getUrlTitle(uri, function(err, title) {
          if (err) {
            console.log('Error reading URL heading: ', err);
            return res.sendStatus(404);
          }

          Links.create({
            url: uri,
            title: title,
            baseUrl: req.headers.origin,
            userId: userId 
          })
          .then(function(newLink) {
            res.status(200).send(newLink);
          });
        });
      }
    });

    
  });

});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/login', 
function(req, res) {
  console.log('login screen session', req.session);
  res.render('login');
});

app.post('/login', 
function(req, res) {
  console.log(req.body);
  console.log(req.session);
  var username = req.body.username;
  var password = req.body.password;
  new User({ username: username }).fetch().then(function(found) {
    if (found && found.get('password') === password) {
      console.log('found the user in the database and logged in');
      req.session.regenerate( function() {
        req.session.user = username;
        res.redirect('/');
      });
    } else {
      console.log('didnt find user in database');
      //res.status(400).send();
      res.redirect(401, '/login');
    }
  });
});

app.get('/signup', 
function(req, res) {
  res.render('signup');
});

app.post('/signup', 
function(req, res) {
  console.log('posted for signup');
  console.log(req.body);
  new User({ username: req.body.username }).fetch().then(function(found) {
    if (found) {
      console.log('Already signed up');
      res.redirect('/login');
    } else {
      console.log('making a new user');
      Users.create({
        username: req.body.username,
        password: req.body.password
      })
      .then(function(newUser) {
        console.log(newUser);
        req.session.regenerate( function() {
          req.session.user = req.body.username;
          res.redirect(201, '/');
          // res.status(200).send(newUser);
        });
      });
    }
  });
});

app.get('/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('/');
  });
});



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  console.log('does it do a get request', req.body.url)
  new User({ username: req.session.user }).fetch().then(function(found) {
    if (found) {
      new Link({ code: req.params[0], userId: found.get('id') }).fetch().then(function(link) {
        if (!link) {
          console.log('cant find link', req.params[0], found.get('id'));
          res.redirect('/');
        } else {
          console.log('we get in here I believe');
          var click = new Click({
            linkId: link.get('id')
          });

          click.save().then(function() { 
            link.set('visits', link.get('visits') + 1);
            link.save().then(function() {
              console.log('i think it should get here', link)
              return res.redirect(link.get('url'));
            });
          });
        }
      });
    } else { //not found
      //console.log('not found', req.session.user, found)
      new Link({ code: req.params[0] }).fetch().then(function(link) {
        if (!link) {
          res.redirect('/');
        } else {
          var click = new Click({
            linkId: link.get('id')
          });
          click.save().then(function() { 
            link.set('visits', link.get('visits') + 1);
            link.save().then(function() {
              console.log('i think it should get here', link)
              return res.redirect(link.get('url'));
            });
          });



        }//else
      });
    }

  });
});
console.log('Shortly is listening on 4568');
app.listen(4568);
