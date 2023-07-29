const mongoose = require('mongoose')

const productSchema = mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        lot : {
            type: String,
            required: false
        },
        serial : {
            type: String,
            required: false
        },
        weight : {
            type: String,
            required: false
        },
        expiry : {
            type: Date,
            required: false
        },
        bestbefore : {
            type: Date,
            required: false
        },
        storage : {
            type: String,
            required: false
        },
        link : {
            type: String,
            required: false
        },
        emission : {
            type: Number,
            required: false
        },
        category : {
            type: String,
            required: false
        },
       
    },
    {
        timestamps: false
    }
)


const Product = mongoose.model('Product', productSchema);

module.exports = Product;