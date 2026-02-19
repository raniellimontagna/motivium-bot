import { createCommand } from '#discord'
import { ApplicationCommandType } from 'discord.js'
import { triggerNewsChannels } from '../../schedulers/news-channels/news-channels.js'

createCommand({
  name: 'noticias',
  description: 'Gatilho manual para envio de notícias aos canais configurados 🗞️',
  type: ApplicationCommandType.ChatInput,
  async run(interaction) {
    const { client } = interaction
    
    await interaction.deferReply({ ephemeral: true })

    try {
      await triggerNewsChannels(client)
      await interaction.editReply({
        content: '✅ Processamento de notícias iniciado com sucesso!',
      })
    } catch (error) {
      await interaction.editReply({
        content: '❌ Ocorreu um erro ao tentar disparar as notícias.',
      })
    }
  },
})
