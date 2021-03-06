var url = require('url');
var jwt = require('jsonwebtoken');
var sendgrid = require('sendgrid')(process.env.SENDGRID_USERNAME, process.env.SENDGRID_PASSWORD);
var config = require('../../config/environment');
var User = require('../../api/user/user.model');

/**
 * Set token cookie directly for oAuth strategies
 */
function forgotPassword(req, res) {
  var email = req.query.email;

  User.findOne({
    email: email
  }, '-salt -hashedPassword', function(err, user) { // don't ever give out the password or salt
    if (user === null) {
      res.send(200, 'User not found. Verify your email address.');
    } else {
      var token = jwt.sign({
        email: email
      }, config.secrets.session, {
        expiresIn: '1h'
      });

      var uri = url.parse('http://' + req.headers.host + '/reset/' + token);

      var emailForgot = new sendgrid.Email({
        to: email,
        from: 'willy' + '@' + 'stophe' + '.' + 'fr',
        fromname: 'BOSS',
        subject: 'BOSS Password Reset Link',
        text: 'BOSS Password Reset Link',
        html: 'Hello ' + user.name + ', <br/><br/> You recently requested a link to reset your BOSS password. <br/>Please set a new password by following the link below: <br/><br/>' +
          '<a href="' + uri.href + '">' + uri.href + '</a>' +
          '<br><br>BOSS'
      });
      sendgrid.send(emailForgot, function(err, json) {
        if (err) {
          res.send(200, err);
        } else {
          res.send(200, 'You\'ve got mail. Check your inbox for a password reset link, valid 1 hour.');
        }
      });
    }
  });
}

exports.forgotPassword = forgotPassword;
