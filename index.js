let cors = require('cors');
let express = require('express');
let app = express();
var mongoose = require('mongoose');
require('dotenv').config();

// Import Models
let itemModel = require('./App/models/item.model');
let orderModel = require('./App/models/order.model');
let userModel = require('./App/models/user.model');

app.use(cors());
app.use(express.json());

// ==========================================
// USER AUTHENTICATION APIS
// ==========================================

// 1. Seed Default Users (Initial setup)
app.get("/api/seed-users", async (req, res) => {
    try {
        let count = await userModel.countDocuments();
        if (count === 0) {
            await userModel.insertMany([
                { username: "admin", password: "admin123", role: "manager" },
                { username: "staff", password: "staff123", role: "staff" }
            ]);
            res.send("<h1>✅ Success! Default accounts created.</h1>");
        } else {
            res.send("<h1>⚠️ Users already exist! No new accounts created.</h1>");
        }
    } catch (err) {
        res.status(500).send("Error: " + err.message);
    }
});

// 2. Register New User (Matches your login.html popup)
app.post("/api/register", async (req, res) => {
    try {
        const { username, password, role } = req.body;

        const existingUser = await userModel.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ status: 0, message: "User already registered! Kindly login." });
        }

        const newUser = new userModel({ username, password, role });
        await newUser.save();

        res.json({ status: 1, message: "Registered Successfully! Please login." });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ status: 0, message: "Error registering user" });
    }
});

// 3. Login User
app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        
        let user = await userModel.findOne({ username: username, password: password });

        if (user) {
            // Returning status, role, and username for frontend session storage
            res.json({ 
                status: 1, 
                role: user.role, 
                username: user.username, 
                message: "Login Successful" 
            });
        } else {
            res.json({ status: 0, message: "Invalid username or password" });
        }
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ status: 0, message: "Internal server error" });
    }
});

// ==========================================
// ITEM APIS
// ==========================================
app.post('/api/item-insert', async (req, res) => {
    try {
        let { name, price, quantity, available , description, image, category} = req.body;
        if (!name || price === undefined) return res.status(400).json({ status: 0, message: "Name and price are required" });
        
        let item = new itemModel({
            name, price, quantity: quantity ?? 0, available: available ?? true,
            description: description ?? "", image: image ?? "", category,
        });

        await item.save();
        res.status(201).json({ status: 1, message: "Item inserted successfully" });
    } catch (err) {
        res.status(500).json({ status: 0, message: "Error inserting item", error: err.message });
    }
});

app.get("/api/item-list", async (req, res) => {
    try {
        let itemList = await itemModel.find();
        res.status(200).json({ status: 1, message: "Item list fetched successfully", data: itemList });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Error fetching item list", error: error.message });
    }
});

app.delete("/api/item-delete/:id", async (req, res) => {
    try {
        let deletedItem = await itemModel.deleteOne({ _id: req.params.id });
        if (deletedItem.deletedCount === 0) return res.send({ status: 0, message: "Item not found" });
        res.send({ status: 1, message: "Item deleted successfully" });
    } catch (error) {
        res.send({ status: 0, message: "Error deleting item", error: error.message });
    }
});

app.put('/api/item-update/:id', async (req, res) => {
    try {
        let updatedItem = await itemModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedItem) return res.status(404).json({ status: 0, message: "Item not found" });
        res.status(200).json({ status: 1, message: "Item updated successfully", data: updatedItem });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Error updating item", error: error.message });
    }
});

// ==========================================
// ORDER APIS
// ==========================================
// ==========================================
// ORDER APIS (Updated for Delivery & Pickup)
// ==========================================
app.post('/api/order-insert', async (req, res) => {
    try {
        let { items, paymentMethod, orderType, teacherName, department, phoneNumber } = req.body;
        if (!items || items.length === 0) return res.status(400).json({ status: 0, message: "Order must have items" });

        // ==========================================
        // BULLETPROOF PAYMENT FIX
        // Forces whatever the frontend sends into "cash" or "upi"
        // ==========================================
        paymentMethod = String(paymentMethod).toLowerCase().trim();
        if (paymentMethod !== "cash" && paymentMethod !== "upi") {
            paymentMethod = "cash"; // Default to cash if it says "Cash on Delivery", "COD", etc.
        }

        // Stock Update Logic
        for (let i = 0; i < items.length; i++) {
            let updatedItem = await itemModel.findOneAndUpdate(
                { _id: items[i].itemId, available: true, quantity: { $gte: items[i].quantity } },
                { $inc: { quantity: -items[i].quantity } },
                {returnDocument: 'after'}
            );
            if (!updatedItem) return res.status(400).json({ status: 0, message: `Item out of stock` });
            if (updatedItem.quantity === 0) await itemModel.updateOne({ _id: updatedItem._id }, { available: false });
        }

        let total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        let today = new Date(); today.setHours(0, 0, 0, 0);
        let todayOrdersCount = await orderModel.countDocuments({ date: { $gte: today } });

        let order = new orderModel({ 
            items, 
            total, 
            paymentMethod: paymentMethod, 
            paymentStatus: "pending", 
            invoiceNo: Date.now(), 
            tokenNo: todayOrdersCount + 1,
            orderType: orderType || "Pickup",
            teacherName: teacherName || "",
            department: department || "",
            phoneNumber: phoneNumber || ""
        });
        
        await order.save();
        res.status(201).json({ status: 1, message: "Order placed successfully", data: order });
    } catch (err) {
        // THIS LOGS THE EXACT ERROR TO YOUR TERMINAL
        console.error("\n❌ MONGOOSE SAVE ERROR:", err.message, "\n");
        res.status(500).json({ status: 0, message: "Error placing order", error: err.message });
    }
});

app.get('/api/order-list', async (req, res) => {
    try {
        let orders = await orderModel.find().sort({ date: -1 });
        res.status(200).json({ status: 1, message: "Orders fetched successfully", data: orders });
    } catch (err) {
        res.status(500).json({ status: 0, message: "Error fetching orders", error: err.message });
    }
});

app.delete('/api/order-delete/:id', async (req, res) => {
    try {
        const deletedOrder = await orderModel.findByIdAndDelete(req.params.id);
        if (!deletedOrder) return res.status(404).json({ status: 0, message: "Order not found" });
        res.json({ status: 1, message: "Order deleted successfully" });
    } catch (error) {
        res.status(500).json({ status: 0, message: "Failed to delete order" });
    }
});

app.put('/api/order-update/:id', async (req, res) => {
    try {
        let order = await orderModel.findByIdAndUpdate(req.params.id, { paymentStatus: req.body.paymentStatus }, { new: true });
        res.status(200).json({ status: 1, message: "Order updated successfully", data: order });
    } catch (err) {
        res.status(500).json({ status: 0, message: "Error updating order" });
    }
});

// ==========================================
// SALES PAGE API
// ==========================================
app.get('/api/sales', async (req, res) => {
    try {
        let today = new Date(); today.setHours(0, 0, 0, 0);
        let monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

        let allOrders = await orderModel.find();
        let todayOrders = allOrders.filter(o => new Date(o.date) >= today);
        let monthOrders = allOrders.filter(o => new Date(o.date) >= monthStart);

        let dailyLabels = []; let dailySales = [];
        for (let i = 6; i >= 0; i--) {
            let day = new Date(); day.setDate(day.getDate() - i); day.setHours(0, 0, 0, 0);
            let nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1);
            let dayOrders = allOrders.filter(o => { let d = new Date(o.date); return d >= day && d < nextDay; });
            dailySales.push(dayOrders.reduce((sum, o) => sum + o.total, 0));
            dailyLabels.push(day.toLocaleDateString('en-IN', { weekday: 'short' }));
        }

        let categoryMap = {};
        allOrders.forEach(order => {
            order.items.forEach(item => {
                categoryMap[item.name] = (categoryMap[item.name] || 0) + (item.price * item.quantity);
            });
        });

        res.status(200).json({
            status: 1, message: "Sales data fetched",
            data: {
                dailySales: todayOrders.reduce((sum, o) => sum + o.total, 0),
                monthlySales: monthOrders.reduce((sum, o) => sum + o.total, 0),
                dailyOrders: todayOrders.length,
                dailyChart: { labels: dailyLabels, data: dailySales },
                categoryChart: { labels: Object.keys(categoryMap), data: Object.values(categoryMap) },
                // Dummy monthly chart data (simplified)
                monthlyChart: { labels: ["Jan", "Feb", "Mar", "Apr"], data: [1000, 2000, 1500, monthOrders.reduce((sum, o) => sum + o.total, 0)] },
                paymentChart: { labels: ["Cash", "UPI"], data: [
                    allOrders.filter(o => o.paymentMethod === "cash").reduce((s, o) => s + o.total, 0),
                    allOrders.filter(o => o.paymentMethod === "upi").reduce((s, o) => s + o.total, 0)
                ]}
            }
        });
    } catch (err) { res.status(500).json({ status: 0, message: "Sales error" }); }
});

// ==========================================
// MONGODB CONNECTION
// ==========================================
mongoose.connect(process.env.MONGO_URL).then(() => {
    console.log("Connected to MongoDB");
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running on port ${process.env.PORT || 8000}`);
    });
}).catch((err) => { console.log(err) });