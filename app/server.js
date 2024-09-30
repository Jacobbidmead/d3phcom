const moment = require('moment') // for date/time
const cron = require('node-cron') // https://www.youtube.com/watch?v=ARvIYcoVXgI for pulling at time intervals
const api = require('axios') // for making api requests to twitter
require('dotenv').config() // for proprietary variables
const PORT = process.env.PORT || 3000 // for communicating between server and fe websocket
const express = require('express')
const app = express();
const http = require('http')
const server = http.createServer(app)
const cors = require('cors')
const mongoose = require('mongoose')
// All mongo models used below
const Tweets = require("./models/Tweets")
const THV = require("./models/TweetHistoricalValues")
const Users = require('./models/twitter_users')
const PHV = require('./models/PeopleHistoricalValues')
const HistVals = require('./models/HistoricalValues')
const Keywords = require('./models/Keywords')
const twtrUserEndpoint = `https://api.twitter.com/2/users/`
const twtrEndpoint = `https://api.twitter.com/2/tweets/search/recent`
const sgEndpoint = `httpsL//api.sendgrid.com/v3/mail/send`
// OpenAI / GPT API
const {Configuration, OpenAI} = require('openai')
// 

// Sendgrid for sending emails
const sendEmail = require('@sendgrid/mail')
sendEmail.setApiKey(process.env.SENDGRID_API_KEY)
console.log(process.env.SENDGRID_API_KEY)

// spear fishing or wide net?
let mode = "spearfishing"
let gauge = 0.0

app.use(cors({
    origin: ["https://d3ph.com"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}))
// Socket.io
// Web sockets (test version will has different origin)
let numOfUsers = 0;
const io = require('socket.io')(server, {
    cors: {
      origin: ["https://d3ph.com"],
      methods: ["GET", "POST"],
      transports: ['websocket', 'polling']
    //   origin: ["http://localhost:3000"]
      // https://www.youtube.com/watch?v=xUqvXaiCmHI <-- for going live on cpanel
    },
    
  })

  io.on('connection', async socket => {
    numOfUsers += 1
    console.log('New Client Connection detected:', socket.id, numOfUsers, 'user(s) online')
    socket.emit('mode', mode)
    // gauge will equal finding the latest entry in the HistVals model
    gauge = await HistVals.findOne().sort({post_date: -1})
    gauge = gauge.final_gauge
    socket.emit('hvals', gauge)
    console.log(`gauge: ${gauge}`)
    // socket.emit('kws', fe_kws)
    // socket.on('changeKW', (kw) => {
      
    //   setTimeout(() => {
    //     let rtData = fe_data.find(ob => ob.kw == kw) // check fe_package() for obj structuring
    //     socket.emit('tweets', rtData.tweets)
    //     socket.emit('hvals', rtData.hvals)
    //   }, 500)
      
    // })
    socket.on('disconnect', () => {
      numOfUsers -= 1;
    //   socket.broadcast.emit('audience', numOfUsers)
      console.log(`${socket.id} has left (${numOfUsers} remaining)`)
    })
    socket.on('createUser', (users) => {
        console.log(`User(s) requested: ${users}`)
        // getNewUsers(users).then(() => console.log("Finished gathering new user(s)"))
        getNewUsers(users).then((userNames) => {
            console.log('userNames var:', userNames)
            socket.emit('successAddUser', userNames)
        })
    })
    socket.on('mode', modestr => { // when any user changes the mode, it is broadcasted to all for change
        mode = modestr
        console.log('mode', mode)
        socket.broadcast.emit('mode', mode)
    })
  })

  server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`)
  })

  // Add error handling to catch any uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

  async function getNewUsers(userString) {
    console.log("Getting new user(s)...")
    try {
        const userData = await api.get(twtrUserEndpoint, {
            headers: {
                'Authorization' : process.env.BT
            }, 
            params: {
                'ids': `${userString}`, // change ids to get different users
                'user.fields': 'id,username,name,description,public_metrics,created_at,profile_image_url,verified,protected'
            }
        })
        const newUsers = userData.data.data
        let userNames = ' '
        for(const user of newUsers) {
            let found = await Users.findOne({author_id: user.id})
            if (!found) {
                console.log("New user detected:", user.username)
                userNames+= user.username
                const pm = user.public_metrics
                await Users.create({
                    post_date: moment.now(),
                    author_id: user.id,
                    username: '@'+user.username,
                    name: user.name,
                    created_at: moment(user.created_at),
                    vip: true,
                    profile_image_url: user.profile_image_url
                }).catch(err => console.log(err))
                await PHV.create({
                    post_date: moment.now(),
                    author_id: user.id,
                    name: user.name,
                    description: user.description,
                    tweet_count: pm.tweet_count,
                    followers_count: pm.followers_count,
                    following_count: pm.following_count,
                    listed_count: pm.listed_count,
                    verified: user.verified,
                    protected: user.protected
                }).catch(err => console.log(err))
            } else {
                console.log("User already exists:", user.username)
                userNames+= user.username + ' (already exists, vip updated to true)'
                Users.updateOne({author_id: user.id}, {vip: true}).catch(err => console.log(err))
                
            }
        }
        console.log("Finished gathering new user(s)")
        return userNames
    } catch (err) {
        console.log(err)
        return err
    }
    
}

// Connect to MDB, everything happens within the domain of connection
mongoose.connect(process.env.MONGODB_URL, {
    useNewUrlParser: true, useUnifiedTopology: true
    }).then(() => {
        console.log("Connected to MongoDB on", moment().format('MMM Do hh:mm:ss'))
    }).catch(err => {
        console.log("Could not connect to MongoDB", err)
    })
    function toRFC3339(date) {
        return date.toISOString();
    } 
    function getTime(limit){
        const now = new Date()
        let result = new Date(now)
        if (limit == "hour"){
            result.setHours(now.getHours() - 1)
        } else if (limit == "minute"){
            result.setMinutes(now.getMinutes() - 1)
        }
        return result
    }
    async function storeTweetsinMongo(kw, data, currentDT){ // for use in tweet pull
        // data is a batch of tweets for a specific keyword.
        if(!data){
            console.log("No data to add to DB for", kw.kw_string)
        } else {
            console.log("Storing tweets in DB...")
            let tweetsData = data.map(tweet => {
                return {
                  post_date: currentDT.utc(),
                  created_at: moment(tweet.created_at),
                  text: tweet.text,
                  query_kw: kw.kw_string,
                  tweet_id: tweet.id,
                  author_id: tweet.author_id,
                  convo_id: tweet.conversation_id,
                }
              })
              let THVData = data.map(tweet => {
                return {
                  tweet_id: tweet.id,
                  post_date: currentDT.utc(),
                  retweet_count: tweet.public_metrics.retweet_count,
                  reply_count: tweet.public_metrics.reply_count,
                  like_count: tweet.public_metrics.like_count,
                  quote_count: tweet.public_metrics.quote_count,
                  impression_count: tweet.public_metrics.impression_count
                }
              })
            try{
                await Tweets.insertMany(tweetsData, {ordered: false})
                  .catch(err => {
                    let numInserted = err.result.result.nInserted
                    if (numInserted > 0){
                      console.log(`${kw.kw_string}: ${numInserted} tweets were inserted into Mongo.`)
                    } else {
                        console.log("No tweets were inserted into the database for", kw.kw_string)
                    }
                  })
                await THV.insertMany(THVData, {ordered: false})
                    .catch(err => {console.log(err)}) 
                }catch(err){
                    console.log(err)
            }
            
        }
    }
    
    // The code for the entire program occurs after a connection to MDB is established
// getNewUsers();
const getTweets = cron.schedule(`*/${mode == "widenet" ? 10 : 5} * * * *`, async () => { // every three minutes with specific users, every 10 minutes for everyone. 
    let currentDT = moment()
    const now = new Date()
    console.log("Gathering new tweets...", moment().format('MMM Do hh:mm:ss'))

    // Get Keywords and VIP Authors from Mongo
    let kws = await Keywords.find({}).catch(err => console.log("Error getting keywords: \n", err))
    
    console.log("Running tweet pull on mode", mode)
    let vipUsers = await Users.find({vip: true}).catch(err => {
        console.log("Error getting VIP users: \n", err)
    })

    if (!vipUsers){
        console.error("No VIP users found in Mongo.")
        return
    }

    let ugString = vipUsers.map(user => user.username.substring(1)).join(" OR from:"); 
    

    // Query Twitter API
    
    
    for (const kw of kws) {
        
        // Grab Tweets from Twitter based on Keyword
        console.log(`KEYWORD: ${kw.kw_string} TWEET COLLECTION:`)
        let myQuery = mode == "widenet" ? `(${kw.kw_string}) -is:retweet` : `(${kw.kw_string}) (from:${ugString}) -is:retweet` // VIP users without retweets
        try { 
            console.log("Getting new tweets...")
            console.log(`users: ${myQuery}`)
            let newTweets = await api.get(twtrEndpoint, {
                
                headers: {
                'Authorization': process.env.BT
                }, 
                params: {
                query: myQuery,
                start_time: toRFC3339(getTime("hour")),
                end_time: toRFC3339(getTime("minute")),
                'tweet.fields': 'created_at,text,author_id,conversation_id,public_metrics',
                // 'media.fields': `type:photo,url,preview_`,
                // 'user.fields': `id,username`,
                max_results: 100
                }
                
                
            }).catch(err => console.log(err.response))
            console.log(newTweets.data)
            console.log(`Query:${kw.kw_string} ${ugString}`) // Shows full query being sent to twitter for the kw (ONLY FOR VIP CONSTRAINT)
        let newTweetBatch = newTweets.data.data ? newTweets.data.data.length : ["There were no tweets for", kw.kw_string, "from Twitter."]
        console.log(`NEW TWEETS:\n`, newTweetBatch) // params returned from newTws: status,statusText,headers,config,request,data
        // inside the data param is another data param to pull data.

        // Clean Data and Store in MDB (Tweets)
        storeTweetsinMongo(kw, newTweets.data.data, currentDT) 
        } catch (err) {
            console.log("There was an error when trying to obtain new tweets:")
            console.log(err.response ? err.response.data.errors : err)
        }
    }
    
    // new function end
    // Gather average sentiment based on Tweet text & Store in MDB Final Gauge
    // Determine whether or not an alert needs to be sent (get score threshold)    

})
const evaluateSentiment = cron.schedule("*/29 * * * *", async () => {
    console.log(`
    ________________________________
    Performing Sentiment Analysis...
    `)
    // Grab all tweets from the recent tweet pull from MongoDB
    
    try {
        const now = moment().utc()
        const thirtyMinutesAgo = moment(now).utc().subtract(30, "minutes").toDate()
        console.log(`Thirty minutes ago: ${thirtyMinutesAgo}`)
        
        let recentTweets = await Tweets.find({
        post_date: {
            $gte: thirtyMinutesAgo
        }
        }).catch(err => console.log(err))
        console.log(`${recentTweets.length} tweets were added to Mongo in the last 30 minutes.`)
        console.log(recentTweets)
        // Batched request of tweets, prompt for sentiment analysis
        // let batchedTweetText = ""
        // Strip the links out of the text for sending to GPT
        const urlRegex = /https?:\/\/\S+/g;
        recentTweets = recentTweets.map(tweet => {
            return tweet.text.replace(urlRegex, '')
        })
        let batchedTweetText = JSON.stringify(recentTweets)
        console.log(`
            TWEET BATCH 
            ${batchedTweetText}
        `)

        // Configure GPT object and request SA
        const gpt = new OpenAI({apiKey: process.env.GPTKEY});

        const gptCall = await gpt.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{role: "system", content: "Return a parseable JSON object with three attributes. The first attribute being your reasoning behind the sentiment and your recommendation (1-2 sentences) as to whether or not someone living near Taiwan should evacuate based on historical context and the Defcon standard (call it evacuation_recommendation). Please also include a few sentences (max 5) on what tweets most heavily influenced the sentiment value and why--(you must call it influential_tweets). The third attribute being a value for tweets that provide sentiment analysis with values between 0 and 10. Please call it average_sentiment_value. The higher the value, the more likely the overall sentiment is negative. These tweets are about war in taiwan or china, so the most serious sentiment value of 10 will be indicative of a serious situation such as bombs dropping or people currently being killed. We do not care about things that happen in the distant past, only recently (as in today) A 5-6.9 is moreso things are starting to get serious but no real action yet. The tweets will be all batched in a single string. The return should be a number noting average sentiment value of all tweets combined. The final attribute of the object should be something that can go in an email subject line (called email_subject_line) indicating the recommended action in less than 10 words."},
                    {role: "user", content: batchedTweetText}
                    ]
        })
        console.log("GPT RESULT:\n____________\n")
        // console.log(gptCall.choices[0].message)
        // send email with results
        let gptSentiment = JSON.parse(gptCall.choices[0].message.content)
        console.log(gptSentiment)
        gauge = gptSentiment.average_sentiment_value
        console.log(`Gauge: ${gauge}`)
        try {
            if (gptSentiment.average_sentiment_value >= 8.5) {
                console.log("Sending E-Mail...")
                // send email >>>THRESHOLD LINE 255<<<
                // const recipients = ['jpcoder12@gmail.com', 'findfreddy@icloud.com', 'findfreddy@gmail.com']
                const message = {
                    to: [{email: 'findfreddy@icloud.com'}, {email: 'jpcoder12@gmail.com'}],
                    from: 'myanon808@gmail.com',
                    subject: `${gptSentiment.email_subject_line}`,
                    text: `${gptSentiment.evacuation_recommendation}`,
                    html: `<h1>The gauge has reached a score of ${gptSentiment.average_sentiment_value}.</h1>
                            <p>${gptSentiment.evacuation_recommendation}</p><br></br>
                            <p>${gptSentiment.influential_tweets}</p>
                            <p>${recentTweets}</p>
                            `
                }
                await sendEmail.send(message).then(response => console.log('Email Sent!\n', response)).catch(err => console.log(err))
            } else {
                console.log("No email will be sent because the score is not high.")
            }
        } catch (err) {
            console.log(err)
        }
        // add final gauge to hist vals w freddy 
        await HistVals.create({
            final_gauge: gauge,
            post_date: now
        })
        
    } catch(err){
        console.log(err)
    }
    
        //  WHAT IF NO TWEETS WERE ADDED IN LAST X MINUTES:???
    

    
    
    // Calc Average Score for each score returned and post final_gauge 
})


