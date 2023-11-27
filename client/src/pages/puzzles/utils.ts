export function calculateNewRating(rating: number, success: boolean) {
    return rating + Math.floor(Math.random() * 10) + (100 * (success ? 1 : -1))
}