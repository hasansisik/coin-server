const Footer = require("../models/Footer");

// Initialize footer with default values
const initializeFooter = async (req, res) => {
  try {
    // Check if footer already exists
    const existingFooter = await Footer.findOne();
    if (existingFooter) {
      return res.status(400).json({ message: "Footer already exists" });
    }

    // Create initial footer with default values
    const footer = await Footer.create({
      info: {
        title: "info header",
        content: "info content",
      },
      kvk: {
        title: "KVK Aydınlatma Metni",
        content: "Default KVK content",
      },
      forms: [],
    });

    res.status(201).json(footer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get footer data
const getFooter = async (req, res) => {
  try {
    let footer = await Footer.findOne();
    if (!footer) {
      footer = await Footer.create({
        info: {
          title: "info header",
          content: "info content",
        },
        kvk: {
          title: "KVK Aydınlatma Metni",
          content: "Default KVK content",
        },
      });
    }
    res.status(200).json(footer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update KVK
const updateKvk = async (req, res) => {
  try {
    const { title, content } = req.body;
    let footer = await Footer.findOne();
    if (!footer) {
      footer = await Footer.create({ kvk: { title, content } });
    } else {
      footer.kvk = { title, content };
      await footer.save();
    }
    res.status(200).json(footer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// update info
const updateInfo = async (req, res) => {
  try {
    const { title, content } = req.body;
    let footer = await Footer.findOne();
    if (!footer) {
      footer = await Footer.create({ info: { title, content } });
    } else {
      footer.info = { title, content };
      await footer.save();
    }
    res.status(200).json(footer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Update social menu
const updateSocialMenu = async (req, res) => {
  try {
    const socialMenuItems = req.body;

    if (!Array.isArray(socialMenuItems) || socialMenuItems.length === 0) {
      return res
        .status(400)
        .json({ message: "Social menu items are required" });
    }

    let footer = await Footer.findOne();
    if (!footer) {
      footer = await Footer.create({ socialMenu: socialMenuItems });
    } else {
      footer.socialMenu = socialMenuItems;
      await footer.save();
    }
    res.status(200).json(footer);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

const deleteSocialMenuItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    let footer = await Footer.findOne();

    if (!footer || !footer.socialMenu) {
      return res
        .status(404)
        .json({ message: "Footer or social menu not found" });
    }

    footer.socialMenu = footer.socialMenu.filter(
      (item) => item._id.toString() !== itemId
    );
    await footer.save();

    res.status(200).json(footer);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getFooter,
  updateKvk,
  updateInfo,
  initializeFooter,
  updateSocialMenu,
  deleteSocialMenuItem,
};
