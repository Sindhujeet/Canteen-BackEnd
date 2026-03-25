let mongoose = require('mongoose');

let orderSchema = new mongoose.Schema({

    items: [
        {
            name: {
                type: String,
                required: true
            },
            price: {
                type: Number,
                required: true
            },
            quantity: {
                type: Number,
                required: true
            }
        }
    ],

    total: {
        type: Number,
        required: true
    },

    paymentMethod: {
        type: String,
        enum: ["cash", "upi"],
        default: "cash"
    },

    paymentStatus: {
        type: String,
        enum: ["pending", "paid"],
        default: "pending"
    },

    invoiceNo: {
        type: Number,
        unique: false
    },

    date: {
        type: Date,
        default: Date.now
    },

    tokenNo: {
        type: Number,
        default: 0,
    }

});

let orderModel = mongoose.model('Order', orderSchema);

module.exports = orderModel