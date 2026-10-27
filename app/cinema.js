export async function renderCinema(){
  const { renderCinemaRoom } = await import("./cinema/cinema.js");
  renderCinemaRoom();
}
