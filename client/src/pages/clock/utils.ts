export function formatTime(numSeconds: number) {
    const sec_num = Math.floor(numSeconds)
    const hours = Math.floor(sec_num / 3600);
    const minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    const seconds = sec_num - (hours * 3600) - (minutes * 60);
    const dec = Math.floor((numSeconds * 10) % 10)
    const hourDisplay = String(hours).padStart(2, "0")
    const minDisplay = String(minutes).padStart(2, "0")
    const secDisplay = String(seconds).padStart(2, "0")
    const decSecondsDisplay = (sec_num < 10) ? "." + String(dec) : ""
    const s = ":"
    return hourDisplay + s + minDisplay + s + secDisplay + decSecondsDisplay;
}