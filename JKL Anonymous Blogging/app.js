//jshint esversion:6
require("dotenv").config();
const express = require("express");
const path = require('path');
const favicon = require('serve-favicon')
const serveStatic = require('serve-static');
const sendMail = require("./mail");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require("lodash");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const nl2br  = require('nl2br');


const blogsStartingContent = "This section is the summary of all users' blogs.";
const yourBlogsStartingContent = "This section is the summary of your own blogs.";
const aboutContent = "Anonymous Blogging is to provide a platform for people to share thoughts anonymously. \r\n It has great benefits as the following: ";
const contactContent = "If you would like to contact us, please shoot a message!";

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(express.json());
app.use(favicon(path.join(__dirname, 'public', 'images','favicon.ico')))


app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://admin-julia:Test123@cluster0.3vub9.mongodb.net/blogDB", {useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set('useCreateIndex', true);


const postSchema = {
  title: String,
  content: String
}

const Post = mongoose.model("Post", postSchema);

const userSchema = new mongoose.Schema ({
  email: String,
  password: String,
  googleId: String,
  facebookId: String,
  twitterId: String,
  microsoftID: String,
  post: [postSchema] //note: [postSchema]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/blogs",
    userProfile:"https://www.googleapis.com/oauth2/userinfo",

  },
  function(accessToken, refreshToken, profile, cb) {
    // console.log(profile);

    User.findOrCreate({ googleId: profile.id, username: profile.emails[0].value }, function (err, user) {
      return cb(err, user);  //username: profile.emails[0].value & "email" on line app.get('/auth/google',
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.APP_ID,
    clientSecret: process.env.APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/blogs",
  },
  function(accessToken, refreshToken, profile, done) {
    User.findOrCreate({ facebookId: profile.id, username: profile.displayName }, function(err, user) {
      if (err) { return done(err); } //username: profile.displayName
      done(null, user);
    });
  }
));

passport.use(new TwitterStrategy({
    consumerKey: process.env.Twitter_API_KEY,
    consumerSecret: process.env.API_SECRET_KEY,
    callbackURL: "http://localhost:3000/auth/twitter/blogs",
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ twitterId: profile.id, username: profile.displayName}, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new MicrosoftStrategy({
        clientID: process.env.Microsoft_APP_ID,
        clientSecret: process.env.SECRET_ID,
        callbackURL: "http://localhost:3000/auth/microsoft/blogs",
        scope: ['user.read']
      },
      function(accessToken, refreshToken, profile, done) {
        User.findOrCreate({ microsoftId: profile.id, username: profile.displayName }, function (err, user) {
          return done(err, user);
        });
      }
    ));

const none = "none";
const show = "";

app.get('/', function(req, res){
  res.render("home", {displayType: none});
  // res.redirect("/home");
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', "email"] }));

app.get('/auth/google/blogs',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect to blogs.
    res.redirect('/blogs');
  });

app.get('/auth/facebook', passport.authenticate('facebook'));

app.get('/auth/facebook/blogs',
  passport.authenticate('facebook', { successRedirect: '/blogs',
                                    failureRedirect: '/login' }));

app.get('/auth/twitter', passport.authenticate('twitter'));

app.get('/auth/twitter/blogs',
  passport.authenticate('twitter', { failureRedirect: '/login' }),
    function(req, res) {
      res.redirect('/blogs');
});

app.get('/auth/microsoft',
      passport.authenticate('microsoft'));

app.get('/auth/microsoft/blogs',
  passport.authenticate('microsoft', { failureRedirect: '/login' }),
    function(req, res) {
      res.redirect('/blogs');
  });


app.get("/login", function(req, res){
  res.render("login", {displayType: none});
});


app.get("/signup", function(req, res){
  res.render("signup", {displayType: none});
});


app.get("/blogs", function(req, res) {
  if (req.isAuthenticated()) {
    User.find({"post": {$ne: null}}, function(err, foundUsers){   //#note: the find result could be > 1
      if (err) {
        console.log(err);
      } else {
        if (foundUsers) {
          res.render("blogs", {usersWithPosts: foundUsers, startingContent: blogsStartingContent, displayType: show});
        }
      }
    });
  }else {
    res.redirect('/');
  }
});

app.get("/yourblogs", function(req, res){
  if (req.isAuthenticated()) {
    //User.findOne({id: req.user.id}, function(err, foundUser){ //doesn't work
    User.findById(req.user.id, function(err, foundUser){
      if (err) {
        console.log(err);
      } else {
        res.render("yourblogs", {thisUserPost: foundUser.post, startingContent: yourBlogsStartingContent, displayType: show});
      }
    });
  } else {
    res.redirect('/login');
  }
});

app.get("/compose", function(req, res) {
  if (req.isAuthenticated()){
    res.render("compose", {displayType: show});
  } else {
    res.redirect('/login');
  }
});

app.get("/about", function(req, res) {
  if (req.isAuthenticated()){
    res.render("about", {about: aboutContent, displayType: show});
  } else {
    res.render("about", {about: aboutContent, displayType: none});;
  }
});

app.get("/contact", function(req, res) {
  if (req.isAuthenticated()){
    res.render("contact", {contact: contactContent, displayType: show, successDisplay: none, failDisplay: none});
  } else {
    res.render("contact", {contact: contactContent, displayType: none, successDisplay: none, failDisplay: none});
  }
});

app.get("/blogs/:postName", function(req, res){
  // console.log(req.params.postName);
  const requestedTitle = _.lowerCase(req.params.postName);

  User.find({"post": {$ne: null}}, function(err, foundUsers){ //#note: the find result could be > 1
    if (err) {
      console.log(err)
    } else if (foundUsers) {
      foundUsers.forEach(function(foundUser){
        foundUser.post.forEach(function(p) {
          const storedTitle = _.lowerCase(p.title);
          if (requestedTitle === storedTitle) {
            res.render("post", {postPage: p, displayType: none});
            return;
          }
        })
      });
    }
  });
});

app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});


app.post("/signup", function(req, res) {

  User.register({username: req.body.username}, req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/signup");
    } else {
      passport.authenticate("local")(req, res, function(){
          res.redirect("/blogs");
      });
    }
  })
});


app.post("/login", function(req, res){

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        res.locals.session = true;
        res.redirect("/blogs");
      });
    }
  });
});


app.post("/compose", function(req, res) {
  // console.log(req.body.newContent);
  const composedPost = new Post({
    title: req.body.newTitle,
    content: nl2br(req.body.newContent, false)
    // content: req.body.newContent
  });

  User.findById(req.user.id, function(err, foundUser){
    if (err) {
      console.log(err)
    } else {
      if (foundUser) {
        foundUser.post.push(composedPost);
        foundUser.save(function() {
          res.redirect("/blogs");
        })
      }
    }
  });
});

app.post("/contact", function(req, res){
  const data = {
    name: req.body.name,
    email: req.body.email,
    subject: req.body.subject,
    message: req.body.message
  };

  const { name, email, subject, message } = req.body;
  // console.log('Data: ', req.body);

  sendMail(name, email, subject, message, function(err, data) {
    if (err) {
      // console.log(err)
      //res.status(500).json({ Result : 'Internal Error' });
      res.render("contact", {contact: contactContent, displayType: none, successDisplay: none, failDisplay: show})
    } else {
      // res.redirect("/contact");
      res.render("contact", {contact: contactContent, displayType: none, successDisplay: show, failDisplay: none})
      // res.json({ Result : 'Message Sent!' });
    }
  })
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function() {
  console.log(`Server started on ${ port }`);
  // console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});
