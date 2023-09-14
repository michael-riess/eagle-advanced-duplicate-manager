const fetch = require("electron-fetch").default;

// TODO: remove duplicate code e.g. createLibraryItem
// must have at least { path, name, tags }
async function addImageToLibrary({ path, name, tags }) {
  try {
    const api = "http://localhost:41595/api/item/addFromPath";
    const body = { path, name, tags: [...new Set(tags)] };
    const result = await fetch(api, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }).then((res) => res.json());
    if (result.status === "error") {
      throw new Error(result);
    }
    console.log("ADDED IMAGE TO LIBRARY: ", result);
  } catch (error) {
    console.log("ERROR ADDING IMAGE TO LIBRARY: ", error, src);
  }
}

async function updateLibraryItemTags({ id, tags }) {
  try {
    const api = "http://localhost:41595/api/item/update";
    const body = { id, tags: [...new Set(tags)] };
    const result = await fetch(api, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }).then((res) => res.json());
    if (result.status === "error") {
      throw new Error(result);
    }
    console.log("UPDATED IMAGE TAGS: ", result);
  } catch (error) {
    console.log("ERROR UPDATING IMAGE TAGS: ", error, src);
  }
}

async function updateLibraryItemImage({ newPath, data }) {
  deleteLibaryItems([data.id]);
  createLibraryItem({ path: newPath, data });
}

async function createLibraryItem({ path, data }) {
  try {
    const api = "http://localhost:41595/api/item/addFromPath";
    const body = {
      ...data,
      path,
    };
    const result = await fetch(api, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }).then((res) => res.json());
    if (result.status === "error") {
      throw new Error(result);
    }
    console.log("CREATED LIBRARY ITEM: ", result);
  } catch (error) {
    console.log("ERROR CREATING LIBRARY ITEM: ", error, src);
  }
}

async function deleteLibaryItems(ids) {
  try {
    const api = "http://localhost:41595/api/item/moveToTrash";
    const body = { itemIds: ids };
    const result = await fetch(api, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }).then((res) => res.json());
    if (result.status === "error") {
      throw new Error(result);
    }
    console.log("DELETED ITEMS: ", result);
  } catch (error) {
    console.log("ERROR DELETING ITEMS: ", error, src);
  }
}

async function* libraryItems() {
  const api = "http://localhost:41595/api/item/list";
  const limit = 200;
  let offset = 0;
  let allItemsFetched = false;
  while (!allItemsFetched) {
    console.log("LIMIT: ", limit);
    console.log("OFFSET: ", offset);
    const { data } = await fetch(`${api}?limit=${limit}&offset=${offset}`).then(
      (response) => response.json()
    );
    for (item of data) {
      yield item;
    }
    if (data.length < 1) {
      allItemsFetched = true;
    }
    offset += 1;
  }
  return;
}

// async function updateLibraryImageData(data) {
//     try {
//         const api = "http://localhost:41595/api/item/update";
//         const result = await fetch(api, {
//           method: "POST",
//           body: JSON.stringify(data),
//           headers: { "Content-Type": "application/json" },
//         }).then((res) => res.json());
//         if (result.status === "error") {
//           throw new Error(result);
//         }
//         console.log("UPDATED IMAGE DATA: ", result);
//       } catch (error) {
//         console.log("ERROR UPDATING IMAGE DATA: ", error, src);
//       }
// }

module.exports = {
  libraryItems,
  addImageToLibrary,
  updateLibraryItemTags,
  updateLibraryItemImage,
  createLibraryItem,
  deleteLibaryItems,
};
