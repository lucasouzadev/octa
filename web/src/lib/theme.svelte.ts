// A screen that paints over the whole page (the danger screen) asks the browser chrome
// to take its color too. The layout reads this before falling back to the route's color.
export const theme = $state<{ override: string | null }>({ override: null });
