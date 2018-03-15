const config = require('../../config.json')
const filterFeed = require('./filters.js')
const generateEmbed = require('./embed.js')
const Article = require('./Article.js')
const getSubs = require('./subscriptions.js')

module.exports = (guildRss, rssName, rawArticle, isTestMessage, returnObject) => {
  const rssList = guildRss.sources
  const source = rssList[rssName]

  const article = new Article(rawArticle, guildRss, rssName)
  article.subscriptions = getSubs(source, article)

  // if (returnObject) return article

  // Filter message
  let filterExists = false
  if (source.filters && typeof source.filters === 'object') {
    for (var prop in source.filters) {
      if (prop !== 'roleSubscriptions') filterExists = true // Check if any filter categories exists, excluding roleSubs as they are not filters
    }
  }

  const filterResults = filterExists ? filterFeed(source, article, isTestMessage) : isTestMessage ? {passedFilters: true} : false

  if (returnObject) {
    article.filterResults = filterResults
    return article
  }

  if (!isTestMessage && filterExists && !filterResults) return null // Feed article delivery only passes through if the filter found the specified content

  const finalMessageCombo = {}
  if (typeof source.embedMessage === 'object' && typeof source.embedMessage.properties === 'object' && Object.keys(source.embedMessage.properties).length > 0) { // Check if embed is enabled
    finalMessageCombo.embedMsg = generateEmbed(rssList, rssName, article)

    let txtMsg = ''
    if (typeof source.message !== 'string') {
      if (config.feeds.defaultMessage.trim() === '{empty}') txtMsg = ''
      else txtMsg = article.convertKeywords(config.feeds.defaultMessage)
    } else if (source.message.trim() === '{empty}') txtMsg = ''
    else txtMsg = article.convertKeywords(source.message)

    finalMessageCombo.textMsg = txtMsg
  } else {
    let txtMsg = ''
    if (typeof source.message !== 'string' || source.message.trim() === '{empty}') {
      if (config.feeds.defaultMessage.trim() === '{empty}') txtMsg = ''
      else txtMsg = article.convertKeywords(config.feeds.defaultMessage)
    } else txtMsg = article.convertKeywords(source.message)

    finalMessageCombo.textMsg = txtMsg
  }

  // Generate test details
  if (isTestMessage) {
    let testDetails = ''
    const footer = '\nBelow is the configured message to be sent for this feed:\n\n--'
    testDetails += `\`\`\`Markdown\n# BEGIN TEST DETAILS #\`\`\`\`\`\`Markdown`

    if (article.title) {
      testDetails += `\n\n[Title]: {title}\n${article.title}`
    }

    if (article.summary && article.summary !== article.description) {  // Do not add summary if summary === description
      let testSummary
      if (article.description && article.description.length > 500) testSummary = (article.summary.length > 500) ? `${article.summary.slice(0, 490)} [...]\n\n**(Truncated summary for shorter rsstest)**` : article.summary // If description is long, truncate summary.
      else testSummary = article.summary
      testDetails += `\n\n[Summary]: {summary}\n${testSummary}`
    }

    if (article.description) {
      let testDescrip
      if (article.summary && article.summary.length > 500) testDescrip = (article.description.length > 500) ? `${article.description.slice(0, 490)} [...]\n\n**(Truncated description for shorter rsstest)**` : article.description // If summary is long, truncate description.
      else testDescrip = article.description
      testDetails += `\n\n[Description]: {description}\n${testDescrip}`
    }

    if (article.date) testDetails += `\n\n[Published Date]: {date}\n${article.date}`
    if (article.author) testDetails += `\n\n[Author]: {author}\n${article.author}`
    if (article.link) testDetails += `\n\n[Link]: {link}\n${article.link}`
    if (article.subscriptions) testDetails += `\n\n[Subscriptions]: {subscriptions}\n${article.subscriptions.split(' ').length - 1} subscriber(s)`
    if (article.images) testDetails += `\n\n${article.listImages()}`
    let placeholderImgs = article.listPlaceholderImages()
    if (placeholderImgs) testDetails += `\n\n${placeholderImgs}`
    if (article.tags) testDetails += `\n\n[Tags]: {tags}\n${article.tags}`
    if (filterExists) testDetails += `\n\n[Passed Filters?]: ${filterResults.passedFilters ? 'Yes' : 'No'}${filterResults.passedFilters ? filterResults.listMatches(false) + filterResults.listMatches(true) : filterResults.listMatches(true) + filterResults.listMatches(false)}`
    testDetails += '```' + footer

    finalMessageCombo.testDetails = testDetails
  }

  return finalMessageCombo
}
