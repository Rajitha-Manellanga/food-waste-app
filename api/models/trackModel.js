const mongoose = require('mongoose')

const producttrackSchema = mongoose.Schema(
    {
        productId: {
            type: String,
            required: true
        },
        indate : {
            type: Date,
            required: true
        },
        expiry : {
            type: Date,
            required: false
        },
        bestbefore : {
            type: Date,
            required: false
        },
        link : {
            type: String,
            required: false
        },
       
    },
    {
        timestamps: false
    }
)


const Track = mongoose.model('Track', producttrackSchema);

module.exports = Track;