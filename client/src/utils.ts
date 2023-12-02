export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}

export function tryOrUndefined<T>(f: () => T): T | undefined {
    try {
        return f()
    } catch (e) {
        return undefined
    }
}