/**
 * Creates a simple ASCII chart of water level trends
 * @param history Array of water level data points
 * @returns ASCII chart as a string
 */
export function createAsciiChart(history: Array<{ date: string; level: number }>, width = 24) {
  if (!history || history.length === 0) {
    return "No data available for chart"
  }

  // Limit to the specified width
  const data = history.slice(0, width).reverse()

  // Find min and max values for scaling
  const levels = data.map((item) => item.level)
  const min = Math.min(...levels)
  const max = Math.max(...levels)

  // If all values are the same, we'll show a flat line
  if (min === max) {
    return `Water level stable at ${min} cm over the last ${data.length} hours\n${"─".repeat(width)}`
  }

  // Chart height (number of rows)
  const height = 5
  const range = max - min

  // Create the chart
  let chart = ""

  // Add the chart title
  chart += `Water level trend (last ${data.length} hours):\n`

  // Add the max value
  chart += `${max} cm ┐\n`

  // Generate the chart rows
  for (let row = 0; row < height; row++) {
    const threshold = max - range * (row / (height - 1))

    for (let col = 0; col < data.length; col++) {
      const value = data[col].level

      if (col === 0) {
        chart += "│"
      }

      if (row === height - 1 && value === min) {
        chart += "└"
      } else if (row === 0 && value === max) {
        chart += "┐"
      } else if (value >= threshold) {
        chart += "│"
      } else {
        chart += " "
      }
    }
    chart += "\n"
  }

  // Add the min value
  chart += `${min} cm `

  // Add the time axis
  chart += "└" + "─".repeat(data.length - 1) + "┘\n"

  // Add first and last time labels
  const firstTime = data[0].date.split(" ")[1].substring(0, 5)
  const lastTime = data[data.length - 1].date.split(" ")[1].substring(0, 5)
  chart += `${firstTime}${" ".repeat(data.length - firstTime.length - lastTime.length)}${lastTime}`

  return chart
}
