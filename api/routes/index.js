const { response } = require('express');
const mongoose = require("mongoose");
var MongoClient = require('mongodb').MongoClient;
var express = require('express');
const router = express.Router();
const http = require('http');
const fs = require('fs');
const Product = require('../models/productModel');
const path = require('path');
const admin=require('firebase-admin');
const QRCode = require('qrcode');
const json2html = require('json2html');
const date = require('date-and-time');
module.exports = router;
require('dotenv').config();

//mongodb setting for products db
const dbProductUrl = process.env.MONGODB;

//const dbProduct = mongoose.createConnection(dbProductUrl);
//const dbConsumer = mongoose.createConnection(dbConsumerUrl);
mongoose.connect(dbProductUrl).then(()=>{
  console.log("DB Products connected");
},(err)=>{
  console.log(err);
});

//firebase settings for consumer db
var serviceAccount = {
  "type": "service_account",
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "private_key_id": process.env.FIREBASE_PVT_KEY_ID,
  "private_key": process.env.FIREBASE_PVT_KEY,
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": process.env.FIREBASE_AUTH_URI,
  "token_uri": process.env.FIREBASE_TOKEN_URI,
  "auth_provider_x509_cert_url": process.env.FIREBAE_AUTH_PROVIDER,
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_CERT_URL,
  "ignoreUndefinedProperties": true
}

const exp = require('constants');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE
});

var db = admin.database();
var productRef=db.ref();




router.get('/products/:id', async(req, res) =>{
  try {
      const {id} = req.params;
      const product = await Product.findById(id);
      let already_expire = false;
      let expiry;
      let bestbefore;
      if(product.expiry !== undefined){
        console.log(product.expiry);
        expiry = new Date(product.expiry);
        console.log(expiry);
        expiry = date.format(expiry, "DD MM YYYY");
        console.log(expiry);
      }else{
        expiry = "not found";
      }
      if(product.bestbefore !== undefined){
        bestbefore = new Date(product.bestbefore);
        bestbefore = date.format(bestbefore, "DD MMM YYYY");
      }else{
        bestbefore = "not found";
      }
      if(expiry != "not found"){
        let timeDifference =  new Date(expiry).getTime() - new Date().getTime();
        console.log(date.format(new Date(), "DD MM YYYY"));
        let differenceDays = Math.ceil(timeDifference / (1000 * 3600 * 24));
         if(differenceDays < 0) {
            already_expire = true;
         }
      }
      newProduct = {
        "name" : product.name,
        "expiry" : expiry,
        "bestbefore" : bestbefore,
        "storage" : product.storage,
        "link" : product.link,
        "weight" : product.weight,
        "category" : product.category,
        "emission" : product.emission,
        "expired" : already_expire
      }
      res.status(200).json(newProduct);
  } catch (error) {
      res.status(500).json({message: error.message})
  }
});

router.get('/duration/', async(req,res)=>{
  try {
    let counter_future = 0;
    let counter_past = 0;
    let message = " ";
    let soonexp = [];
    let alreadyexp = [];
    productRef.once('value',(snap)=>{
      //res.status(200).json({"savedprodcuts":snap.val()});
      snap.forEach((childsnap)=>{
        let expiry = childsnap.val().expiry;
        if(expiry != "not found"){
          let timeDifference =  new Date(expiry).getTime() - new Date().getTime();
          let differenceDays = Math.ceil(timeDifference / (1000 * 3600 * 24));
          console.log(new Date().getTime());
          console.log(differenceDays);
           if(differenceDays >= 0 && differenceDays <=3){
            soonexp.push(childsnap.val().name);
             counter_future++;
           }
           if(differenceDays < 0) {
            alreadyexp.push(childsnap.val().name);
              counter_past++;
           }
        }
        if(counter_future > 0 && counter_past == 0){
          message = soonexp +" "+"going to expire soon!";
        }
        if(counter_future > 0 && counter_past > 0){
          message = "food items expiring soon:"+" "+soonexp+" "+"and already expired:"+alreadyexp;
        }
        if(counter_future == 0 && counter_past > 0){
          message = alreadyexp + " "+"expired allready!";
        }
      });

      res.status(200).json({"msg":message});
 
      
      //console.log(new Date().getTime());
     
    });
   
  } catch (error) {
    res.status(500).json({message: error.message})
  }
});
  
router.get('/savedproducts/', async (req,res)=>{
    try {
      let result = [];
      productRef.once('value',(snap)=>{
        //res.status(200).json({"savedprodcuts":snap.val()});
        snap.forEach((childsnap)=>{
          result.push(childsnap.val());
        });
        //console.log(new Date().getTime());
        res.status(200).json(result);
      });
     
    } catch (error) {
      res.status(500).json({message: error.message})
    }
});

router.delete('/delete/:pname', async(req,res)=>{
  try {
    const {pname} = req.params; 
    let product;
    let productKey;
    productRef.once('value',(snap)=>{
      snap.forEach((childsnap)=>{
        if(childsnap.val().name === pname){
          product = new Object(childsnap.val());
          productKey = childsnap.key;
        }
      });

      if(product != undefined){
        db.ref(productKey).remove();
        res.json({message: "Product deleted successfully"});
      }  
      else
          res.json({message: "Product not found"});
    });
  } catch (error) {
    res.status(500).json({message: error.message})
  }
});

router.get('/findproduct/:pname', async (req,res)=>{
  try {
    const {pname} = req.params; 
    let product;
    productRef.once('value',(snap)=>{
      snap.forEach((childsnap)=>{
        if(childsnap.val().name === pname){
          product = new Object(childsnap.val());
        }
      });

      if(product != undefined)
          res.json(product);     
      else
          res.json({message: "Product not found"})
    });
  } catch (error) {
    res.status(500).json({message: error.message})
  }
});

router.post('/generateqr/', async(req,res)=>{
  try {
    const {item1, item2,beforedate} = req.body;
    let qrname = Date.now();
    if(item2 !== undefined)
      QRCode.toFile(path.join(__dirname,'../public/images/qr.png'),
    "https://foodwaste-api.onrender.com/scanqr/?item1="+item1+"&item2="+item2+"&bd="+beforedate
    )
    else
      QRCode.toFile(path.join(__dirname,'../public/images/qr.png'),
    "https://foodwaste-api.onrender.com/scanqr/?item1="+item1+"&bd="+beforedate
    )
    var filename = 'qr.png';
    //let filePath = +qrname+'.png';
    //res.status(200).json({"msg": qrname+'.png'});
    res.setHeader('Content-Disposition', 'attachment; filename=' + filename);
    res.sendFile(filename, {root: 'public/images'});
  } catch (error) {
    res.status(500).json({message: error.message})
  }
});

router.get('/scanqr/', async (req,res)=>{
  try {
    item1 = req.query.item1;
    item2 = req.query.item2;
    beforedate = req.query.bd;
    var product1,product2;
    
    productRef.once('value',(snap)=>{
      snap.forEach((childsnap)=>{
        console.log(childsnap.val());
        if(childsnap.val().name == item1){
          product1 = childsnap.val();
        }
        if(childsnap.val().name == item2){
          product2 = childsnap.val();
        }
      });
      if(product1 != undefined){
        if(product2 != undefined){
          list = {
            "Main food Item" : [
              {"Name": product1.name, "Bestbefore Date": product1.bestbefore,
               "Expiry Date": product1.expiry,
               "Color/Smell/Shape Changes": product1.changes,
               "Storage": product1.storage,
               "Remarks": product1.note, },
              
            ],
            "Additional food Item" : [
              {"Name": product2.name, "Bestbefore Date": product2.bestbefore,
               "Expiry Date": product2.expiry,
               "Color/Smell/Shape Changes": product2.changes,
               "Storage": product2.storage,
               "Remarks": product2.note, },
              
            ],
            "Cook/Prepare Before Date" : [{"Date":beforedate}]
          };
        }else{
          list = {
            "Main food Item" : [
              {"Name": product1.name, "Bestbefore Date": product1.bestbefore,
               "Expiry Date": product1.expiry,
               "Color/Smell/Shape Changes": product1.changes,
               "Storage": product1.storage,
               "Remarks": product1.note, },
              
            ],
            "Cook/Prepare Before Date" : [{"Date":beforedate}]
          };
        }
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(json2html.render(list));
      }else{
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(json2html.render({"Error": "Products are not found!"}));
      }
      
      
      //res.json(list);
     
    });
   
  } catch (error) {
    res.status(500).json({message: error.message});
  }

});


router.post('/save/', async (req,res)=>{
  try {
    const {name, expiry, bestbefore, storage} = req.body;
    data = {};
    data["name"] = name;
    data["expiry"] = expiry;
    data["bestbefore"] = bestbefore;
    data["storage"] = storage;
  
    productRef.orderByChild("name")
    .equalTo(name)
    .once('value')
    .then(snap => {
      if(snap.exists()){
        console.log("data already exists");
        res.json({"msg": "Product already exists!"});
      }else{
        productRef.push(data);
        res.json(data);
      }
    });
  
   
  } catch (error) {
    res.status(500).json({message: error.message});
  }
});

router.put('/update/', async(req,res)=>{
  try {
    const {pname,changes,note} = req.body;
    console.log(changes);
    productRef.once('value', (snap)=>{
      snap.forEach((child)=>{
          if (child.val().name === pname){
              if(changes === true){
                db.ref(child.key).update({"changes" : "Yes"});
              }
              if(changes === false){
                db.ref(child.key).update({"changes" : "No"});
              }
              if(note != null){
                db.ref(child.key).update({"note" :note});
              }

              res.status(200).json({message: "Product updated successfully"});

          }
      });
    });
   

  } catch (error) {
     res.status(500).json({message: error.message})
  }
});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Smart barcodes testing project' });
});

// render example milk product
router.get('/milk', function(req, res) {
  try {
    const options = {root: path.join(__dirname, "../links")};
    res.sendFile('milk.html',options);
  } catch (error) {
    console.log(error);
  }
  
});

router.get('/apple', function(req, res) {
  try {
    const options = {root: path.join(__dirname, "../links")};
    res.sendFile('apple.html',options);
  } catch (error) {
    console.log(error);
  }
  
});

router.get('/meatballs', function(req, res) {
  try {
    const options = {root: path.join(__dirname, "../links")};
    res.sendFile('meatballs.html',options);
  } catch (error) {
    console.log(error);
  }
  
});

router.get('/bread', function(req, res) {
  try {
    const options = {root: path.join(__dirname, "../links")};
    res.sendFile('bread.html',options);
  } catch (error) {
    console.log(error);
  }
  
});

//router.use(express.static(path.join(__dirname,'public')));









