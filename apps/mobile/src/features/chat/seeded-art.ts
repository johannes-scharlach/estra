import type { ImageSourcePropType } from "react-native";

/**
 * Watercolor art per seeded idea, keyed by title. Style and prompts in
 * `art/README.md`.
 */
export const SEEDED_ART: Record<string, ImageSourcePropType | undefined> = {
  "Pan-Seared Pork Chops with Jammy Zwetschgen (Plums)": require("./art/pork-chops-plums.jpg"),
  "Late-Summer Charred Sweet Corn, Zucchini & Feta Skillet": require("./art/corn-zucchini-feta.jpg"),
  "Brown-Butter Pfifferlinge (Chanterelles) on Toasted Sourdough": require("./art/chanterelles-toast.jpg"),
  "Sheet-Pan Roasted Sausage, Sweet Bell Peppers & New Potatoes": require("./art/sausage-peppers-potatoes.jpg"),
  "Jammy Cherry Tomato & Ricotta Pasta": require("./art/tomato-ricotta-pasta.jpg"),
  "Flammkuchen with Schmand, bacon and onions": require("./art/flammkuchen.jpg"),
  "Classic Spaghetti Cacio e Pepe": require("./art/cacio-e-pepe.jpg"),
  "Spanish Tortilla de Patatas": require("./art/tortilla-patatas.jpg"),
  "Pasta all’Amatriciana": require("./art/amatriciana.jpg"),
  "Tuscan White Bean & Tuna Salad": require("./art/white-bean-tuna.jpg"),
  "Garlic & Herb Gnocchi with Crispy Pancetta": require("./art/gnocchi-pancetta.jpg"),
  "North African Shakshuka": require("./art/shakshuka.jpg"),
  "Pan-Seared Pork Chops with Apples & Mustard Cream Sauce": require("./art/pork-apples-mustard.jpg"),
  "Roasted Sausage, Fennel & Sweet Potato Traybake": require("./art/sausage-fennel-traybake.jpg"),
  "Crispy Sheet-Pan Gnocchi with Bell Peppers & Mozzarella": require("./art/sheet-pan-gnocchi.jpg"),
  "Korean Stir-Fried Pork Belly with Kimchi (Jaeyuk / Duri-chigi style)": require("./art/pork-kimchi.jpg"),
  "Japanese Gyudon (Beef Rice Bowl)": require("./art/gyudon.jpg"),
  "Gochujang & Honey Glazed Pork Belly with Cucumber Sesame Crunch": require("./art/gochujang-pork-cucumber.jpg"),
};
