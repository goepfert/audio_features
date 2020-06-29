// Local Storage Class
class Store {
  static getData(name) {
    let data;
    if (localStorage.getItem(name) === null) {
      data = [];
    } else {
      data = JSON.parse(localStorage.getItem(name));
    }

    return data;
  }

  static saveData(data, name) {
    localStorage.setItem(name, JSON.stringify(data));
  }
}
