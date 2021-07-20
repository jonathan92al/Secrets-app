//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const FacebookStrategy = require("passport-facebook").Strategy;

const port = process.env.PORT || 3000;

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// connect to database
mongoose.connect('mongodb+srv://admin-Jonathan:' + process.env.DB_PW + '@cluster0.ycyqg.mongodb.net/SecretsDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// database connection check
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("Connected to database.");
});

mongoose.set('useCreateIndex', true);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  facebookId: String,
  secrets: [String]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

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
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://radiant-anchorage-06106.herokuapp.com/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      googleId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "https://radiant-anchorage-06106.herokuapp.com/auth/facebook/secrets",
    profileFields: ['id', 'displayName', 'email']
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      facebookId: profile.id,
      username: profile.emails[0].value
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

/************************** GET requests **********************************/

app.get("/", function(req, res) {
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate("google", {
    scope: ["profile"]
  })
);

app.get("/auth/google/secrets",
  passport.authenticate("google", {
    failureRedirect: "/login"
  }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  }
);

app.get("/auth/facebook",
  passport.authenticate("facebook"));

app.get("/auth/facebook/secrets",
  passport.authenticate("facebook", {
    failureRedirect: "/login"
  }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect("/secrets");
  }
);

app.get("/login", function(req, res) {
  res.render("login");
});

app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/secrets", function(req, res) {
  User.find({"secrets": {$ne: null} }, function(err, foundUsers) {
    if(err) {
      console.log(err);
    } else {
      if(foundUsers) {
        res.render("secrets", {usersWithSecrets: foundUsers});
      }
    }
  });
});

app.get("/submit", function(req, res) {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

/************************** POST requests **********************************/

app.post("/register", function(req, res) {

  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function() {
        res.redirect("/secrets");
      });
    }
  });

});

app.post("/login",
  passport.authenticate("local", {
    failureRedirect: "/login"
  }),
  function(req, res) {
    res.redirect("/secrets");
  });

app.post("/submit", function(req, res) {
  const submittedSecret = req.body.secret;

  User.findById(req.user.id, function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      if (foundUser) {
        foundUser.secrets.push(submittedSecret);
        foundUser.save(function() {
          console.log("Confession added Successfully.");
          res.redirect("/secrets");
        });
      }
    }
  });
});


app.listen(port, function() {
  console.log("Server started on port 3000.");
});
