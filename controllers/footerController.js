const Footer = require('../models/Footer');

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
      aboutUs: "Default About Us Text",
      copyright: " 2025 Your Company Name. All rights reserved.",
      cookiePolicy: {
        title: "Cookie Policy",
        content: "<p>Default cookie policy content</p>"
      },
      kvk: {
        title: "KVK Aydınlatma Metni",
        content: "<p>Default KVK content</p>"
      },
      forms: []
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
        cookiePolicy: {
          title: "Cookie Policy",
          content: "<p>Default cookie policy content</p>"
        },
        kvk: {
          title: "KVK Aydınlatma Metni",
          content: "<p>Default KVK content</p>"
        }
      });
    }
    res.status(200).json(footer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update aboutUs
const updateAboutUs = async (req, res) => {
  try {
    const { aboutUs } = req.body;
    let footer = await Footer.findOne();
    if (!footer) {
      footer = await Footer.create({ aboutUs });
    } else {
      footer.aboutUs = aboutUs;
      await footer.save();
    }
    res.status(200).json(footer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update copyright
const updateCopyright = async (req, res) => {
  try {
    const { copyright } = req.body;
    let footer = await Footer.findOne();
    if (!footer) {
      footer = await Footer.create({ copyright });
    } else {
      footer.copyright = copyright;
      await footer.save();
    }
    res.status(200).json(footer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update cookie policy
const updateCookiePolicy = async (req, res) => {
  try {
    const { title, content } = req.body;
    let footer = await Footer.findOne();
    if (!footer) {
      footer = await Footer.create({ cookiePolicy: { title, content } });
    } else {
      footer.cookiePolicy = { title, content };
      await footer.save();
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

// Update social menu
const updateSocialMenu = async (req, res) => {
  try {
    const socialMenuItems = req.body;

    if (!Array.isArray(socialMenuItems) || socialMenuItems.length === 0) {
      return res.status(400).json({ message: "Social menu items are required" });
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
      return res.status(404).json({ message: "Footer or social menu not found" });
    }

    footer.socialMenu = footer.socialMenu.filter(item => item._id.toString() !== itemId);
    await footer.save();

    res.status(200).json(footer);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

// Add form submission
const addFormSubmission = async (req, res) => {
  try {
    const { email, message } = req.body;
    let footer = await Footer.findOne();
    if (!footer) {
      footer = await Footer.create({ forms: [{ email, message, createdAt: new Date() }] });
    } else {
      footer.forms.push({ email, message, createdAt: new Date() });
      await footer.save();
    }
    res.status(200).json(footer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete form submission
const deleteFormSubmission = async (req, res) => {
  try {
    const { formId } = req.params;
    const footer = await Footer.findOne();
    
    if (!footer) {
      return res.status(404).json({ message: "Footer not found" });
    }

    const formIndex = footer.forms.findIndex(form => form._id.toString() === formId);
    
    if (formIndex === -1) {
      return res.status(404).json({ message: "Form submission not found" });
    }

    footer.forms.splice(formIndex, 1);
    await footer.save();

    res.status(200).json({ message: "Form submission deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getFooter,
  updateAboutUs,
  updateCopyright,
  updateCookiePolicy,
  updateKvk,
  addFormSubmission,
  deleteFormSubmission,
  initializeFooter,
  updateSocialMenu,
  deleteSocialMenuItem
};
