let cors = require('cors');
let express = require('express');
let app = express();
var mongoose = require('mongoose');
let itemModel = require('./App/models/item.model');
let  orderModel = require('./App/models/order.model');
require('dotenv').config();
app.use(cors());
app.use(express.json());

//item apis
//post api
app.post('/api/item-insert', async (req, res) => {
    try {
        let { name, price, quantity, available , description, image, category} = req.body;

        if (!name || price === undefined) {
            return res.status(400).json({
                status: 0,
                message: "Name and price are required"
            });
        }

        if (typeof price !== "number") {
            return res.status(400).json({
                status: 0,
                message: "Price must be a number"
            });
        }

        let item = new itemModel({
            name,
            price,
            quantity: quantity ?? 0,
            available: available ?? true,
            description: description ?? "", //
            image: image ?? "",
            category,
        });

        await item.save();

        res.status(201).json({
            status: 1,
            message: "Item inserted successfully"
        });

    } catch (err) {
        res.status(500).json({
            status: 0,
            message: "Error inserting item",
            error: err.message
        });
    }
});
//get api
app.get("/api/item-list", async (req, res) => {
    try {
        let itemList = await itemModel.find();

        if (itemList.length === 0) {
            return res.status(200).json({
                status: 1,
                message: "No items found",
                data: []
            });
        }

        res.status(200).json({
            status: 1,
            message: "Item list fetched successfully",
            data: itemList
        });

    } catch (error) {
        res.status(500).json({
            status: 0,
            message: "Error fetching item list",
            error: error.message
        });
    }
});

//delete api
app.delete("/api/item-delete/:id", async (req, res) => {
    try {
        let itemId = req.params.id;

        if (!itemId) {
            return res.send({ status: 0, message: "Item ID is required" });
        }

        let deletedItem = await itemModel.deleteOne({ _id: itemId });

        if (deletedItem.deletedCount === 0) {
            return res.send({
                status: 0,
                message: "Item not found or already deleted"
            });
        }

        res.send({
            status: 1,
            message: "Item deleted successfully",
            id: itemId
        });

    } catch (error) {
        res.send({
            status: 0,
            message: "Error deleting item",
            error: error.message
        });
    }
});

//update api

app.put('/api/item-update/:id', async (req, res) => {
    try {
        let itemId = req.params.id;
        let { name, price, quantity, available , description, image, category} = req.body;

        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({
                status: 0,
                message: "Invalid Item ID"
            });
        }

        let updateData = {};

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description; //
        if (quantity !== undefined) updateData.quantity=quantity;
         if (image !== undefined) updateData.image = image; 
         if (category !== undefined) updateData.category = category; //need to change it later after special menu is created 
   
        if (price !== undefined) {
            if (typeof price !== "number") {
                return res.status(400).json({
                    status: 0,
                    message: "Price must be a number"
                });
            }
            updateData.price = price;
        }
        if (available !== undefined) updateData.available = available;

        let updatedItem = await itemModel.findByIdAndUpdate(
            itemId,
            updateData,
            { new: true, runValidators: true }
        );
             if (!updatedItem) {
            return res.status(404).json({
                status: 0,
                message: "Item not found"
            });
        }

        res.status(200).json({
            status: 1,
            message: "Item updated successfully",
            data: updatedItem
        });

    } catch (error) {
        res.status(500).json({
            status: 0,
            message: "Error updating item",
            error: error.message
        });
    }
    
});

//order apis
// POST order
app.post('/api/order-insert', async (req, res) => {

     console.log("BODY RECEIVED:", req.body);
    try {
        let { items, paymentMethod } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({
                status: 0,
                message: "Order must have at least one item"
            });
        }

        // STEP 1: Update stock + validate
        for (let i = 0; i < items.length; i++) {

            if (!items[i].itemId || items[i].quantity <= 0) {
                return res.status(400).json({
                    status: 0,
                    message: "Invalid item data"
                });
            }

            let updatedItem = await itemModel.findOneAndUpdate(
                {
                    _id: items[i].itemId,
                    available: true,
                    quantity: { $gte: items[i].quantity }
                },
                {
                    $inc: { quantity: -items[i].quantity }
                },
                { new: true }
            );

            if (!updatedItem) {
                return res.status(400).json({
                    status: 0,
                    message: `Item unavailable or out of stock`
                });
            }

            // Auto-disable if stock finished
            if (updatedItem.quantity === 0) {
                await itemModel.updateOne(
                    { _id: updatedItem._id },
                    { available: false }
                );
            }
        }

        // STEP 2: Calculate total (using frontend values for now)
        let total = items.reduce((sum, item) => {
            return sum + item.price * item.quantity;
        }, 0);

        // STEP 3: Generate invoice + token
        let invoiceNo = Date.now();

        let today = new Date();
        today.setHours(0, 0, 0, 0);

        let todayOrdersCount = await orderModel.countDocuments({
            date: { $gte: today }
        });

        let tokenNo = todayOrdersCount + 1;

        // STEP 4: Save order
        let order = new orderModel({
            items,
            total,
            paymentMethod: paymentMethod || "cash",
            paymentStatus: "pending",
            invoiceNo,
            tokenNo
        });

        await order.save();

        res.status(201).json({
            status: 1,
            message: "Order placed successfully",
            data: order
        });

    } catch (err) {
        res.status(500).json({
            status: 0,
            message: "Error placing order",
            error: err.message
        });
        console.log("BODY RECEIVED:", req.body);
    }
});

// GET all orders
app.get('/api/order-list', async (req, res) => {
    try {
        let orders = await orderModel.find().sort({ date: -1 });

        res.status(200).json({
            status: 1,
            message: "Orders fetched successfully",
            data: orders
        });

    } catch (err) {
        res.status(500).json({
            status: 0,
            message: "Error fetching orders",
            error: err.message
        });
    }
});

// GET single order by ID (for billing page)
app.get('/api/order-detail/:id', async (req, res) => {
    try {
        let order = await orderModel.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                status: 0,
                message: "Order not found"
            });
        }

        res.status(200).json({
            status: 1,
            message: "Order fetched successfully",
            data: order
        });

    } catch (err) {
        res.status(500).json({
            status: 0,
            message: "Error fetching order",
            error: err.message
        });
    }
});

//order status change api

app.put('/api/order-update/:id', async (req, res) => {
    try{
        let order = await orderModel.findByIdAndUpdate(
            req.params.id,
            { paymentStatus: req.body.paymentStatus},
            { new: true }
        );

        if (!order) {
            return res.status(404).json({
                status: 0,
                message: "Order not found"
            });
        }

        res.status(200).json({
            status: 1,
            message: "Order updated successfully",
            data: order
        });

    } catch (err) {
            res.status(500).json({
                status: 0,
                message: "Error updating order",
                error: err.message
            });
        }
    });

    //sales page api
    app.get('/api/sales', async (req, res) => {
    try {
        // Today
        let today = new Date();
        today.setHours(0, 0, 0, 0);

        // Start of this month
        let monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        // Start of this week (Monday)
        let weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        weekStart.setHours(0, 0, 0, 0);

        // All orders
        let allOrders = await orderModel.find();

        // Today's orders
        let todayOrders = allOrders.filter(o => new Date(o.date) >= today);

        // This month's orders
        let monthOrders = allOrders.filter(o => new Date(o.date) >= monthStart);

        // This week's orders
        let weekOrders = allOrders.filter(o => new Date(o.date) >= weekStart);

        // Daily sales — last 7 days
        let dailySales = [];
        let dailyLabels = [];
        for (let i = 6; i >= 0; i--) {
            let day = new Date();
            day.setDate(day.getDate() - i);
            day.setHours(0, 0, 0, 0);
            let nextDay = new Date(day);
            nextDay.setDate(nextDay.getDate() + 1);

            let dayOrders = allOrders.filter(o => {
                let d = new Date(o.date);
                return d >= day && d < nextDay;
            });

            let total = dayOrders.reduce((sum, o) => sum + o.total, 0);
            dailySales.push(total);

            let label = day.toLocaleDateString('en-IN', { weekday: 'short' });
            dailyLabels.push(label);
        }

        // Monthly sales — last 6 months
        let monthlySales = [];
        let monthlyLabels = [];
        for (let i = 5; i >= 0; i--) {
            let d = new Date();
            d.setMonth(d.getMonth() - i);
            let y = d.getFullYear();
            let m = d.getMonth();

            let mOrders = allOrders.filter(o => {
                let od = new Date(o.date);
                return od.getFullYear() === y && od.getMonth() === m;
            });

            let total = mOrders.reduce((sum, o) => sum + o.total, 0);
            monthlySales.push(total);

            let label = d.toLocaleDateString('en-IN', { month: 'short' });
            monthlyLabels.push(label);
        }

        // Category sales — from item names in orders
        let categoryMap = {};
        allOrders.forEach(order => {
            order.items.forEach(item => {
                if (!categoryMap[item.name]) categoryMap[item.name] = 0;
                categoryMap[item.name] += item.price * item.quantity;
            });
        });

        // Payment method breakdown
        let cashOrders = allOrders.filter(o => o.paymentMethod === "cash");
        let upiOrders = allOrders.filter(o => o.paymentMethod === "upi");

        res.status(200).json({
            status: 1,
            message: "Sales data fetched successfully",
            data: {
                dailySales: todayOrders.reduce((sum, o) => sum + o.total, 0),
                monthlySales: monthOrders.reduce((sum, o) => sum + o.total, 0),
                dailyOrders: todayOrders.length,
                weeklyOrders: weekOrders.length,
                dailyChart: { labels: dailyLabels, data: dailySales },
                monthlyChart: { labels: monthlyLabels, data: monthlySales },
                categoryChart: {
                    labels: Object.keys(categoryMap),
                    data: Object.values(categoryMap)
                },
                paymentChart: {
                    labels: ["Cash", "UPI"],
                    data: [
                        cashOrders.reduce((sum, o) => sum + o.total, 0),
                        upiOrders.reduce((sum, o) => sum + o.total, 0)
                    ]
                }
            }
        });

    } catch (err) {
        res.status(500).json({
            status: 0,
            message: "Error fetching sales data",
            error: err.message
        });
    }
});


// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL).then(() => {
    console.log("Connected to MongoDB");
    app.listen(process.env.PORT || 3000, () => {
        console.log(`Server is running on port ${process.env.PORT || 3000}`);
    });
}).catch((err) => { console.log(err) });

