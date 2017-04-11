var express = require("express");
var app = express();
var request = require("request");
var crypto = require("crypto");
var bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

var APP_ID = "58ddcb29-a4b2-46fb-b9c4-90bdeb0164b7";
var APP_SECRET = "1sijffcla0fhk4i6q3iurk27umrievb0";

//Different from production
var WEBHOOK_SECRET = "52py7cs5z2hp67b8vqiiyr9cqjbgxpqk";


const WWS_URL = "https://api.watsonwork.ibm.com";
const AUTHORIZATION_API = "/oauth/token";
var WEBHOOK_VERIFICATION_TOKEN_HEADER = "X-OUTBOUND-TOKEN".toLowerCase();
const WWS_OAUTH_URL = "https://api.watsonwork.ibm.com/oauth/token";

var start = false;
var master;
var spaces = [];
var masterSpaceName;
var colors = ["blue", "red", "orange", "yellow", "purple", "gray", "black", "green", "brown", "pink"];
///
app.get("/", function(req, res) {
  res.send("Luke is alive!");
});
////////////////////
app.post("/webhook", function(req, res) {

  var body = req.body;
  var eventType = body.type;

  //////verification event
  if (eventType === "verification") {
    //console.log("Got here: " + body.challenge);
    verifyWorkspace(res, body.challenge);
    return;
  }
  //////End of verification function//////
  res.status(200).end();

  ///Event type message-created  start
  if (eventType === "message-created") {

    if (body.userId === APP_ID) {
      //console.log("Bot message NOT RESPONDING TO SPACE");
      return;
    }

    var urlQ = "https://workspace.ibm.com/graphql?query=query%20getSpaces%20%7Bspaces(first%3A%202)%20%7B%20items%20%7B%20title%20id%20%20description%20membersUpdated%20members%20%7B%20items%20%7B%20email%0A%20%20%20%20%20%20%20%20%20%20displayName%20%7D%20%7D%20conversation%20%7B%20messages%20%7B%20items%20%7B%20content%20%7D%20%20%7D%20%7D%20%7D%20%7D%20%7D%0A";
    var color;
    //console.log("Body before request: " + JSON.stringify(body));

    //START process setup//
    if (body.content.indexOf("@start") > -1) {

      if (start) {
        console.log("Skipped you");
        return;
      }
      else {
        start = true;
        color = "white";
        console.log("Find first instance of bot to assign master space");

        request.post(urlQ, {
          headers: {
            jwt: JSON.parse(token.req.res.body)["access_token"],
            'Content-Type': 'application/json'
          }
        }, (err, res) => {
          if (err || res.statusCode !== 200) {
            console.log('Error finding user %o', err || res.statusCode);
            return;
          }

          var body2 = JSON.parse(res.body);
          master = body2.data.spaces.items[0].id;
          masterSpaceName = body2.data.spaces.items[0].title;

          sendMessage("Assigned your master space to: " + masterSpaceName, color, master);
          return;
        });
      }
      return;
    }

    else if (body.content.indexOf("@addspace") > -1) {

      console.log("At space:");
      var msg = "https://workspace.ibm.com/enableApp?shareToken=bf300a48-eb9b-4f22-b169-92b0ca20bc65";

      sendMessage(msg, "blue", master);

    } //END OF @SPACE STATEMENT

    else if (body.spaceName != masterSpaceName) {

      //console.log("In here");
      //console.log("Body: " + JSON.stringify(body));

      if (spaces.length == 0) {
        console.log("Spaces is ZERO");
        console.log(body);
        var obj = {
          name: body.spaceName,
          color: colors[0]
        };
        spaces.push(obj);
        var message = "*Space: *" + body.spaceName + "\n*From: *" + body.userName + "\n*URL: * https://workspace.ibm.com/space/" + body.spaceId +  
          "\n----------------------------------\n" + body.content;
        sendMessage(message, colors[0], master);
        colors.shift();
        console.log("Set of space first run: " + spaces);
      }
      else if (spaces.length > 0) {

        var index;
        if (!(spaces.some(function(entry, i) {
            if (entry.name == body.spaceName) {
              index = i;
              return true;
            }
          }))) {
          spaces.push({
            name: body.spaceName,
            color: colors[0]
          });

          var message2 = "*Space: *" + body.spaceName + "\n*From: *" + body.userName + "\n*URL: * https://workspace.ibm.com/space/" + body.spaceId +
            "\n----------------------------------\n" + body.content;
          sendMessage(message2, colors[0], master);
          colors.shift();
          return;
        }
        else if (spaces.some(function(entry, i) {
            if (entry.name == body.spaceName) {
              index = i;
              return true;
            }
          })) {
          var message = "*Space: *" + body.spaceName + "\n*From: *" + body.userName + "\n*URL: * https://workspace.ibm.com/space/" + body.spaceId +
            "\n----------------------------------\n" + body.content;
          sendMessage(message, spaces[index].color, master);
          console.log(spaces);
          return;
        }
      }
    }

  } //END OF MESSAGE CREATED EVENT TYPE

}); /////END OF app.post

//////////////////
///Listener
app.listen(process.env.PORT, process.env.IP, function() {
  console.log("Started App");
});

//Verification function
function verifyWorkspace(response, challenge) {

  //creating the object that is going to be used to send back to Workspace for verification
  var bodyChallenge = {
    //req.body.challenge is what is in the post request that I need to have for Workspace verification
    "response": challenge
  };

  var endPointSecret = WEBHOOK_SECRET;
  var responseBodyString = JSON.stringify(bodyChallenge);

  var tokenForVerification = crypto
    //has the webhook secrte
    .createHmac("sha256", endPointSecret)
    //update the responseBodyString and basically concatonating the webhook to end of it
    .update(responseBodyString)
    //converting that entire string to a hex value
    .digest("hex");
  console.log("before hash");
  //setting the header up with 200 response and the webhook hashed out
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "X-OUTBOUND-TOKEN": tokenForVerification
  });

  response.end(responseBodyString);
  console.log("All hashed up");
}
/////////////End of Verification function
//Assigning token for the oAuth token//
var token = request({

  url: 'https://api.watsonwork.ibm.com/oauth/token',
  method: 'POST',
  auth: {
    user: APP_ID,
    pass: APP_SECRET
  },
  form: {
    'grant_type': 'client_credentials'
  }
}, function(err, res) {

  if (!err == 200) {
    console.log("Crap, not good!!", err);
  }
});
//////////////////End of oAuth piece after setting up token variable/////////////
///Send message to space function

function sendMessage(text, color, master) {
  const appMessage = {
    "type": "appMessage",
    "version": "1",
    "annotations": [{
      "type": "generic",
      "version": "1",
      "title": "",
      "text": "",
      "color": "",
    }]
  };
  const sendMessageOptions = {
    "url": "https://api.watsonwork.ibm.com/v1/spaces/" + master + "/messages",
    "headers": {
      "Content-Type": "application/json",
      "jwt": JSON.parse(token.req.res.body)["access_token"]
    },
    "method": "POST",
    "body": ""
  };

  appMessage.annotations[0].text = text;
  appMessage.annotations[0].color = color;
  sendMessageOptions.body = JSON.stringify(appMessage);

  request(sendMessageOptions, function(err, response, sendMessageBody) {
    if (err || response.statusCode !== 201) {
      console.log("ERROR: Posting to " + sendMessageOptions.url + "resulted on http status code: " + response.statusCode + " and error " + err);
    }
  });

}
