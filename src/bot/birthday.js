const birthdayMemes = [
  'https://i.imgur.com/tCdIzIg.jpeg',
  'https://i.imgur.com/kT0nE9S.jpeg',
  'https://i.imgur.com/WezJN1N.png',
  'https://i.imgur.com/ir9X0Vk.jpeg',
];

function generateBirthdayMessage (playerName) {
  const messages = [
    `🎂 Happy Birthday, ${playerName}! May your day be as awesome as your gaming skills! 🎮`,
    `🎉 Wishing you a fantastic birthday, ${playerName}! Level up in life just like you do in games! 🎮`,
    `🎈 Happy Birthday to the amazing ${playerName}! Another year, another level completed! 🏆`,
    `🎁 It's ${playerName}'s special day! Wishing you epic loot and XP in the year ahead! 🎮`,
    `🎊 Happy Birthday, ${playerName}! May your new age bring you as many victories as in-game! 🏆`
  ];

  return messages[Math.floor(Math.random() * messages.length)];
}

module.exports = {
  birthdayMemes,
  generateBirthdayMessage
};