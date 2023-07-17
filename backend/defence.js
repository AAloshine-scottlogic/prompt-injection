// keep track of active defences as flags
const defences = [
  {
    id: "CHARACTER_LIMIT",
    isActive: false,
  },
];

// activate a defence
function activateDefence(id) {
  const defence = defences.find((defence) => defence.id === id);
  if (defence) {
    defence.isActive = true;
  }
  return defence;
}

// deactivate a defence
function deactivateDefence(id) {
  const defence = defences.find((defence) => defence.id === id);
  if (defence) {
    defence.isActive = false;
  }
  return defence;
}

// get the status of all defences
function getDefences() {
  return defences;
}

// get the status of a single defence
function isDefenceActive(id) {
  const defence = defences.find((defence) => defence.id === id);
  if (defence) {
    return defence.isActive;
  }
  return false;
}

module.exports = {
  activateDefence,
  deactivateDefence,
  getDefences,
  isDefenceActive,
};