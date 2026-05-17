require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const OpenAI = require('openai');

const app = express();

app.use(cors());
app.use(express.json());
app.use(passport.initialize());

mongoose.connect(process.env.MONGO_URL);

const UserSchema = new mongoose.Schema({
 username:String,
 email:String,
 password:String,
 discordId:String
});

const User = mongoose.model('User', UserSchema);

passport.use(new DiscordStrategy({
 clientID:process.env.DISCORD_CLIENT_ID,
 clientSecret:process.env.DISCORD_CLIENT_SECRET,
 callbackURL:process.env.DISCORD_CALLBACK,
 scope:['identify','email']
}, async(accessToken,refreshToken,profile,done)=>{

 let user = await User.findOne({
  discordId:profile.id
 });

 if(!user){

  user = await User.create({
   username:profile.username,
   email:profile.email,
   discordId:profile.id
  });

 }

 return done(null,user);

}));

const openai = new OpenAI({
 apiKey:process.env.OPENAI_API_KEY
});

app.post('/register', async(req,res)=>{

 const {username,email,password} = req.body;

 const hash = await bcrypt.hash(password,10);

 const user = new User({
  username,
  email,
  password:hash
 });

 await user.save();

 res.json({
  message:'Registered'
 });

});

app.post('/login', async(req,res)=>{

 const {email,password} = req.body;

 const user = await User.findOne({email});

 if(!user){
  return res.json({message:'User not found'});
 }

 const match = await bcrypt.compare(password,user.password);

 if(!match){
  return res.json({message:'Wrong password'});
 }

 const token = jwt.sign({id:user._id},process.env.JWT_SECRET);

 res.json({
  token,
  username:user.username
 });

});

app.get('/auth/discord',
 passport.authenticate('discord'));

app.get('/auth/discord/callback',
 passport.authenticate('discord',{session:false}),
 (req,res)=>{

  const token = jwt.sign({
   id:req.user._id
  },process.env.JWT_SECRET);

  res.redirect(
   `http://localhost:5500/?token=${token}`
  );

});

app.post('/api/chat', async(req,res)=>{

 try{

  const msg = req.body.message;

  const completion =
   await openai.chat.completions.create({

    model:'gpt-4.1-mini',

    messages:[
     {
      role:'system',
      content:'Reply short smart helpful friendly.'
     },
     {
      role:'user',
      content:msg
     }
    ],

    max_tokens:150

   });

  res.json({
   reply:completion.choices[0].message.content
  });

 }catch(err){

  res.json({
   reply:'AI Error'
  });

 }

});

app.listen(3000,()=>{
 console.log('AI Running');
});
