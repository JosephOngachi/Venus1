const mongoose = require('mongoose');

const connect = mongoose.connect("mongodb+srv://ongachijoseph:0wQy4TTyhMmMz7Yl@venus.bz9mymp.mongodb.net/?retryWrites=true&w=majority&appName=Venus");

connect.then(() => {
    console.log("Database Connected Successfully");
}).catch(() => {
    console.log("Database cannot be Connected");
});

const Loginschema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    phoneNumber: String,
    referralCode: String,
    investmentAmount: { type: Number, default: 0 },
    investmentEarnings: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 },
    referralCredits: { type: Number, default: 0 },
    referredBy: String,
    countdownStartTime: { type: Date, default: null },
    remainingTime: { type: Number, default: 0 },
    loanLimit: { type: Number, default: 0 },
    loanIssued: { type: Number, default: 0 },
    loanPayable: { type: Number, default: 0 },
    paymentDeadline: { type: String, default: 'N/A' }, // Updated field: Payment Deadline as String
    topup: { type: Number, default: 0 } // New field: topup
});

// Pre-save middleware to update the topup value
Loginschema.pre('save', function(next) {
    this.topup = this.investmentAmount * 0.00193;
    next();
});

const UserModel = mongoose.model("User", Loginschema);

module.exports = UserModel;