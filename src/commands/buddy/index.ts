import type { Command } from '../../commands.js'

const buddy = {
  type: 'local-jsx',
  name: 'buddy',
  description: 'Hatch, pet, and manage your Open Claude companion',
  immediate: true,
  argumentHint: '[status|mode <minimal|balanced|expressive>|rename <name>|edit personality <text>|reset|reroll|mute|unmute|help]',
  load: () => import('./buddy.js'),
} satisfies Command

export default buddy
