export const onboardingArt = {
  welcome: {
    source: require("./art/art-welcome.png"),
    accessibilityLabel: "White beans with roasted tomatoes and basil",
    aspectRatio: 1.25,
  },
  diet: {
    source: require("./art/art-diet.png"),
    accessibilityLabel: "Plate with fish, greens and roasted tomatoes",
  },
  kitchen: {
    source: require("./art/art-kitchen.png"),
    accessibilityLabel: "Dutch oven steaming on a stovetop",
  },
  pantry: {
    source: require("./art/art-pantry.png"),
    accessibilityLabel: "Pantry jars, a tin of tomatoes and olive oil",
  },
  fresh: {
    source: require("./art/art-fresh.png"),
    accessibilityLabel: "Tomatoes on the vine, basil, onion and garlic",
  },
} as const;
