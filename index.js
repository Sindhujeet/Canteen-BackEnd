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
    try {
        let { items, paymentMethod } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({
                status: 0,
                message: "Order must have at least one item"
            });
        }

        // Calculate total automatically
        let total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        // Auto generate invoice number
        let count = await orderModel.countDocuments();
        let invoiceNo = Date.now();

        let order = new orderModel({
            items,
            total,
            paymentMethod: paymentMethod || "cash",
            paymentStatus: "pending",
            invoiceNo
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


// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL).then(() => {
    console.log("Connected to MongoDB");
    app.listen(process.env.PORT || 3000, () => {
        console.log(`Server is running on port ${process.env.PORT || 3000}`);
    });
}).catch((err) => { console.log(err) });

