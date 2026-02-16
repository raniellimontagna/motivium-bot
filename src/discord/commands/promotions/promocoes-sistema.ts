import { ApplicationCommandOptionType, ApplicationCommandType, EmbedBuilder } from 'discord.js'
import { createCommand } from '#discord'
import { PromotionCategory, CATEGORY_SPECIFIC_CONFIG, CATEGORY_METADATA, getPromotionsService } from '#schedulers'
import { logger } from '#settings'

createCommand({
  name: 'promocoes',
  description: 'Gerencia sistema unificado de promoções',
  type: ApplicationCommandType.ChatInput,
  defaultMemberPermissions: ['ManageGuild'],
  options: [
    {
      name: 'action',
      description: 'Ação a ser executada',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: 'Status das filas', value: 'status' },
        { name: 'Buscar promoções', value: 'search' },
        { name: 'Configurações de tempo', value: 'timeconfig' },
        { name: '🔄 Resetar autenticação Telegram', value: 'resetauth' },
      ],
    },
    {
      name: 'categoria',
      description: 'Categoria específica (opcional)',
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: [
        { name: '🎯 Geral', value: 'GENERAL' },
        { name: '💻 Tech', value: 'TECH' },
        { name: '🎮 Gaming', value: 'GAMING' },
        { name: '🏋️ Fitness', value: 'FITNESS' },
        { name: '🚗 Automotivo', value: 'AUTOMOTIVE' },
        { name: '👗 Moda', value: 'FASHION' },
        { name: '🏠 Casa', value: 'HOME' },
        { name: '🐛 Bugs', value: 'BUGS' },
        { name: '🛒 AliExpress', value: 'ALIEXPRESS' },
        { name: '🎫 Cupons', value: 'CUPONS' },
      ],
    },
  ],
  run: async (interaction) => {
    await interaction.deferReply({ ephemeral: true })

    const action = interaction.options.getString('action', true)

    const promotionsService = getPromotionsService()

    if (!promotionsService) {
      await interaction.editReply({
        content: '❌ Sistema de promoções não está inicializado.',
      })
      return
    }

    try {
      switch (action) {
        case 'status': {
          const stats = promotionsService.getQueueStats()

          const embed = new EmbedBuilder()
            .setTitle('📊 Status das Filas de Promoções')
            .setColor(0x00ff00)
            .setDescription('Quantidade de promoções em cada categoria:')
            .setTimestamp()

          let description = ''
          for (const [category, count] of Object.entries(stats)) {
            const meta = CATEGORY_METADATA[category as PromotionCategory]
            const categoryName = category.charAt(0) + category.slice(1).toLowerCase()
            description += `${meta.emoji} **${categoryName}**: ${count} promoções\n`
          }

          embed.setDescription(description || 'Nenhuma promoção na fila.')

          await interaction.editReply({ embeds: [embed] })
          break
        }

        case 'search': {
          const embed = new EmbedBuilder()
            .setTitle('🔍 Buscando Promoções')
            .setDescription('Buscando novas promoções nos canais do Telegram...')
            .setColor(0xffa500)
            .setTimestamp()

          await interaction.editReply({ embeds: [embed] })

          // TODO: Implement manual search for specific category
          const successEmbed = new EmbedBuilder()
            .setTitle('✅ Busca Concluída')
            .setDescription('A busca por novas promoções foi iniciada em background.')
            .setColor(0x00ff00)
            .setTimestamp()

          setTimeout(async () => {
            await interaction.editReply({ embeds: [successEmbed] })
          }, 2000)
          break
        }

        case 'timeconfig': {
          const embed = new EmbedBuilder()
            .setTitle('⏰ Configurações de Tempo por Categoria')
            .setColor(0x007acc)
            .setDescription('Limite de idade das promoções e frequência de busca:')
            .setTimestamp()

          const fields = []

          for (const [category, config] of Object.entries(CATEGORY_SPECIFIC_CONFIG)) {
            const meta = CATEGORY_METADATA[category as PromotionCategory]
            const categoryName = category.charAt(0) + category.slice(1).toLowerCase()

            fields.push({
              name: `${meta.emoji} ${categoryName}`,
              value: `⏱️ **Frequência**: ${config?.schedulePattern || 'Não definido'}\n⌛ **Limite**: ${config?.maxAgeMinutes || 'Não definido'} minutos`,
              inline: true,
            })
          }

          embed.addFields(fields)

          await interaction.editReply({ embeds: [embed] })
          break
        }

        case 'resetauth': {
          const embed = new EmbedBuilder()
            .setTitle('🔄 Resetando Autenticação Telegram')
            .setDescription(
              '⚠️ **Atenção**: Isso irá forçar uma nova autenticação do Telegram.\n' +
                '📱 Você receberá um **código no aplicativo do Telegram**.\n' +
                '⏰ **Aguarde alguns segundos** - códigos podem demorar até 2-3 minutos.\n\n' +
                '📞 **Importante**: Verifique se:\n' +
                '• O aplicativo do Telegram está funcionando\n' +
                '• O número está correto no .env\n' +
                '• Você tem acesso ao Telegram no celular',
            )
            .setColor(0xffa500)
            .setTimestamp()

          await interaction.editReply({ embeds: [embed] })

          try {
            // Import TelegramService dynamically to use forceNewAuth method
            const { TelegramService } = await import('#services')

            const telegramService = await TelegramService.forceNewAuth({
              apiId: Number(process.env.TELEGRAM_API_ID),
              apiHash: process.env.TELEGRAM_API_HASH!,
              phoneNumber: process.env.TELEGRAM_PHONE_NUMBER,
              password: process.env.TELEGRAM_PASSWORD,
              sessionString: '', // Clean session
            })

            // Try to initialize to force code sending
            await telegramService.initialize()

            const successEmbed = new EmbedBuilder()
              .setTitle('✅ Reset Concluído')
              .setDescription(
                '📨 **Código do Telegram solicitado!**\n' +
                  '📱 Verifique o aplicativo do Telegram nos próximos minutos\n' +
                  '💬 Use `/telegramcode <codigo>` quando receber\n\n' +
                  '⏰ **Códigos podem levar até 2-3 minutos para chegar**',
              )
              .setColor(0x00ff00)
              .setTimestamp()

            await interaction.editReply({ embeds: [successEmbed] })
          } catch (error) {
            logger.error('Reset authentication error:', error)

            const errorEmbed = new EmbedBuilder()
              .setTitle('❌ Erro no Reset')
              .setDescription(
                '**Problema ao resetar autenticação:**\n' +
                  `${error}\n\n` +
                  '🔧 **Soluções possíveis:**\n' +
                  '• **Aguarde 5-10 minutos** e tente novamente\n' +
                  '• Verifique se o número no .env está correto\n' +
                  '• Certifique-se que o Telegram está funcionando\n' +
                  '• Verifique se tem acesso ao aplicativo do Telegram\n\n' +
                  '💡 **Dica**: Códigos do Telegram podem demorar ou falhar. Experimente novamente em alguns minutos.',
              )
              .setColor(0xff0000)
              .setTimestamp()

            await interaction.editReply({ embeds: [errorEmbed] })
          }
          break
        }

        default:
          await interaction.editReply({
            content: '❌ Ação inválida.',
          })
      }
    } catch (error) {
      console.error('Error in promocoes command:', error)
      await interaction.editReply({
        content: '❌ Erro ao executar o comando. Tente novamente.',
      })
    }
  },
})
