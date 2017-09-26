'use strict';

const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({region:'us-east-1'});

const categoryType = {
    'MENS':{
        'JEANS': ['BOOTCUT','RELAXED FIT','SLIM'],
        'PANTS': ['SKIN FIT', 'REGULAR FIT'],
        'SHIRTS': ['REGULAR FIT','CLASSIC FIT']

    },
    'WOMENS':{
        'HANDBAGS': ['TOTES'],
        'DRESSES' : ['WEDDING GUEST DRESSES']
    },
    'CONFIRM_OPTIONS': ['YES', 'NO','SHOW ME ANOTHER']
};



// --------------- Helpers to build responses which match the structure of the necessary dialog actions -----------------------

function elicitSlot(sessionAttributes, intentName, slots, slotToElicit, message, responseCard) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'ElicitSlot',
            intentName,
            slots,
            slotToElicit,
            message,
            responseCard,
        },
    };
}

function confirmIntent(sessionAttributes, intentName, slots, message, responseCard) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'ConfirmIntent',
            intentName,
            slots,
            message,
            responseCard,
        },
    };
}

function close(sessionAttributes, fulfillmentState, message, responseCard) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'Close',
            fulfillmentState,
            message,
            responseCard,
        },
    };
}

function delegate(sessionAttributes, slots) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'Delegate',
            slots,
        },
    };
}

// ---------------- Helper Functions --------------------------------------------------

// build a message for Lex responses
function buildMessage(messageContent) {
    return {
        contentType: 'PlainText',
        content: messageContent,
    };
}

// Build a responseCard with a title, subtitle, and an optional set of options which should be displayed as buttons.
function buildResponseCard(title, subTitle, options) {
    let buttons = null;
    if (options !== null) {
        buttons = [];
        for (let i = 0; i < Math.min(5, options.length); i++) {
            buttons.push(options[i]);
        }
    }
    return {
        contentType: 'application/vnd.amazonaws.card.generic',
        version: 1,
        genericAttachments: [{
            title,
            subTitle,
            buttons,
        }],
    };
}

function buildResponseOptions(optionsArray = Array){
    var responseOptions = [];
    for(var i=0; i<optionsArray.length; i++){
        var temp = {
            "text": optionsArray[i],
            "value": optionsArray[i]
        }
        responseOptions.push(temp);
    }
    return responseOptions;
}


function keyExists(key, search) {
    if (!search || (search.constructor !== Array && search.constructor !== Object)) {
        return false;
    }
    for (var i = 0; i < search.length; i++) {
        if (search[i] === key) {
            return true;
        }
    }
    return key in search;
}


// --------------- Intents -----------------------

/**
 * Called when the user specifies an intent for this skill.
 */

function validateInput(intentRequest,callback){
    const outputSessionAttributes = intentRequest.sessionAttributes;
    const source = intentRequest.invocationSource;

    if (source === 'DialogCodeHook') {

        // perform validation on the slot values we have
        const slots = intentRequest.currentIntent.slots;
       const type = (slots.Clothes ? slots.Clothes : 'hi');         //message 1
        const category = (slots.Category ? slots.Category : null);  // message
        const sub_categoryOne = (slots.sub_category ? slots.sub_category : null);
        const sub_categoryTwo = (slots.sub_category_two ? slots.sub_category_two : null);
        const ConfirmationOptions = (slots.ConfirmationOptions ? slots.ConfirmationOptions : null);
        const Welcome_Message = ['SHOP','CUSTOMER CARE','ORDER HISTORY'];
        
       // console.log(type + category + sub_categoryOne + sub_categoryTwo + ConfirmationOptions)

       if (typeof type === null || !Welcome_Message.includes(type.toUpperCase())){
            callback(elicitSlot(outputSessionAttributes, intentRequest.currentIntent.name, slots, 'Clothes',
                buildMessage('Hi there! We have some cool styles you can check out!'),
                buildResponseCard("What would you like to do today?", "Some things you can ask", buildResponseOptions(Welcome_Message))));

        }

        if(! (category && (keyExists(category.toUpperCase(), categoryType)))){
            var menuItem = buildResponseOptions(Object.keys(categoryType));


            callback(elicitSlot(outputSessionAttributes, intentRequest.currentIntent.name, slots, 'Category',
                buildMessage('We have these two options today. what would you like?'),
                buildResponseCard("Choose category", "From below", menuItem.slice(0,2))));
        }
        if(category && (keyExists(category.toUpperCase(), categoryType))){
            var menuItem = buildResponseOptions(Object.keys(categoryType));

            if(category.toUpperCase() == 'MENS' && sub_categoryOne === null){
                console.log(Object.keys(categoryType[category.toUpperCase()]));

                callback(elicitSlot(outputSessionAttributes, intentRequest.currentIntent.name, slots, 'sub_category',
                    buildMessage(`What would you like in ${category}?`),
                    buildResponseCard(`${category}`,`${category} Items`,buildResponseOptions(['JEANS','SHIRTS','PANTS']))));

            }
            else if(category.toUpperCase() == 'WOMENS' && sub_categoryOne === null){
                console.log(Object.keys(categoryType[category.toUpperCase()]));

                callback(elicitSlot(outputSessionAttributes, intentRequest.currentIntent.name, slots, 'sub_category',
                    buildMessage(`What would you like in ${category}?`),
                    buildResponseCard(`${category}`,`${category} Items`,buildResponseOptions(['HANDBAGS','DRESSES']))));
            }
            if(sub_categoryOne && (keyExists(sub_categoryOne.toUpperCase(),categoryType[category.toUpperCase()])) && sub_categoryTwo === null){
                //var menuItem = buildResponseOptions(['JEANS','SHIRT','PANTS']);
                console.log("message 2")
                if(Object.keys(categoryType[category]).includes(sub_categoryOne.toUpperCase())){
                    callback(elicitSlot(outputSessionAttributes, intentRequest.currentIntent.name, slots, 'sub_category_two',
                        buildMessage(`What size ${sub_categoryOne} would you like?`),
                        buildResponseCard(`${sub_categoryOne}`,`${sub_categoryOne} Items`,buildResponseOptions(categoryType[category][sub_categoryOne.toUpperCase()]))));
                }
                else{
                    callback(elicitSlot(outputSessionAttributes, intentRequest.currentIntent.name, slots, 'sub_categoryOne'),
                        buildMessage(`Sorry we only have these options in ${category}`),
                        buildResponseCard(`${category}`,`${category} Items`,menuItem));
                }

            }

            console.log(ConfirmationOptions)
            if(ConfirmationOptions && ConfirmationOptions.toUpperCase() === 'SHOW ME ANOTHER' || sub_categoryTwo && (keyExists(sub_categoryTwo.toUpperCase(),categoryType[category.toUpperCase()][sub_categoryOne.toUpperCase()]))){

                let scanningParameters = {
                    TableName:'product-master',
                    FilterExpression : 'category = :categoryOne AND sub_category1 = :categoryTwo AND sub_category2 = :categoryThree',
                    ExpressionAttributeValues : {':categoryOne':category.toUpperCase(),
                        ':categoryTwo':sub_categoryOne.toUpperCase(),
                        ':categoryThree':sub_categoryTwo.toUpperCase()
                    },
                    Limit: 7000,
                };


                docClient.scan(scanningParameters, function(err, data) {
                    if (err || data.Count === 0) {
                        console.log('ERROR: ' + err + ' Data Count: ' + data.Count);
                    } else {
                        
                        var randomNumber = parseInt(Math.random() * (data.Count - 0) + 0, 10);
                        console.log('Data Count: ' + data.Count + ' Random Number: ' + randomNumber);
                        console.log(data.Items);

                        if(categoryType[category.toUpperCase()][sub_categoryOne.toUpperCase()].includes(sub_categoryTwo.toUpperCase())){

                        console.log('got inside if statement');
                        
                            callback({
                                "sessionAttributes": {},
                                "dialogAction": {
                                    "type": "ElicitSlot",
                                    "intentName":intentRequest.currentIntent.name,
                                    "slots":intentRequest.currentIntent.slots,
                                    "slotToElicit":"ConfirmationOptions",
                                    "message": {
                                        "content": "How about this?",
                                        "contentType": "PlainText"
                                    },
                                    "responseCard": {
                                        "version": 1,
                                        "contentType": "application/vnd.amazonaws.card.generic",
                                        "genericAttachments": [
                                            {
                                                "title": '$'+ data.Items[randomNumber].price,
                                                "subTitle": data.Items[randomNumber].product_desc + ' Style: ' + data.Items[randomNumber].style_group_desc,
                                                "imageUrl": data.Items[randomNumber].image,
                                                "attachmentLinkUrl": data.Items[randomNumber].link,
                                                "buttons": [
                                                    {
                                                        "text": "Show me another",
                                                        "value": "Show me another"
                                                    },
                                                    {
                                                        "text": "Yes",
                                                        "value": "Yes"
                                                    },
                                                    {
                                                        "text": "No",
                                                        "value": "No"
                                                    }
                                                ],
                                            }
                                        ],
                                    },
                                },
                            })
                        } else{
                            callback(elicitSlot(outputSessionAttributes, intentRequest.currentIntent.name, slots, 'sub_categoryTwo'),
                                buildMessage(`Sorry we only have these options in ${category}`),
                                buildResponseCard(`${category}`,`${category} Items`,menuItem));
                        }

                    }
                })
            }


        }
    }
}
function dispatch(intentRequest, callback) {

    console.log(`dispatch userId=${intentRequest.userId}, intent=${intentRequest.currentIntent.name}`);

    const name = intentRequest.currentIntent.name;

    // dispatch to the intent handlers

    return validateInput(intentRequest, callback);

}

// --------------- Main handler -----------------------

// Route the incoming request based on intent.
// The JSON body of the request is provided in the event slot.
exports.handler = (event, context, callback) => {

    console.log(JSON.stringify(event));

    try {
        console.log(`event.bot.name=${event.bot.name}`);

        // fail if this function is for a different bot
        if(! event.bot.name.startsWith(event.bot.name)) {
            callback('Invalid Bot Name');
        }
        dispatch(event, (response) => callback(null, response));
    } catch (err) {
        callback(err);
    }
};