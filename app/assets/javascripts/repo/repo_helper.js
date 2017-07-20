/* global Flash */
import Service from './repo_service';
import Store from './repo_store';
import '../flash';

const RepoHelper = {
  key: '',

  isTree(data) {
    return Object.hasOwnProperty.call(data, 'blobs');
  },

  Time: window.performance
  && window.performance.now
  ? window.performance
  : Date,

  getLanguageForFile(file, langs) {
    const ext = file.name.split('.').pop();
    const foundLang = this.findLanguage(ext, langs);

    return foundLang ? foundLang.id : 'plain';
  },

  findLanguage(ext, langs) {
    langs.find(lang => lang.extensions && lang.extensions.indexOf(`.${ext}`) > -1);
  },

  blobURLtoParent(url) {
    const urlArray = url.split('/');
    urlArray.pop();
    const blobIndex = urlArray.indexOf('blob');

    if (blobIndex > -1) urlArray[blobIndex] = 'tree';

    return urlArray.join('/');
  },

  insertNewFilesIntoParentDir(inDirectory, oldList, newList) {
    if (!inDirectory) return newList;

    const indexOfFile = oldList.findIndex(file => file.url === inDirectory.url);

    if (!indexOfFile) return newList;

    return this.mergeNewListToOldList(newList, oldList, inDirectory, indexOfFile);
  },

  mergeNewListToOldList(newList, oldList, inDirectory, indexOfFile) {
    newList.forEach((newFile) => {
      const file = newFile;
      file.level = inDirectory.level + 1;

      oldList.splice(indexOfFile, 0, file);
    });

    return oldList;
  },

  resetBinaryTypes() {
    const binaryTypeKeys = Object.keys(Store.binaryTypes);

    binaryTypeKeys.forEach((typeKey) => {
      Store.binaryTypes[typeKey] = false;
    });
  },

  setCurrentFileRawOrPreview() {
    Store.activeFile.raw = !Store.activeFile.raw;
    Store.activeFileLabel = Store.activeFile.raw ? 'Preview' : 'Raw';
  },

  setActiveFile(file) {
    if (this.isActiveFile(file)) return;

    Store.openedFiles = Store.openedFiles.map((openedFile, i) => {
      const activeFile = openedFile;
      activeFile.active = file.url === activeFile.url;

      if (activeFile.active) {
        Store.activeFile = activeFile;
        Store.activeFileIndex = i;
      }

      return activeFile;
    });

    this.setActiveToRaw();

    if (file.binary) {
      Store.blobRaw = file.base64;
    } else {
      Store.blobRaw = file.plain;
    }

    if (!file.loading) this.toURL(file.url);
    Store.binary = file.binary;
  },

  setActiveToRaw() {
    Store.activeFile.raw = false;
    // can't get vue to listen to raw for some reason so this for now.
    Store.activeFileLabel = 'Raw';
  },

  isActiveFile(file) {
    return file && file.url === Store.activeFile.url;
  },

  removeFromOpenedFiles(file) {
    if (file.type === 'tree') return;

    Store.openedFiles = Store.openedFiles.filter(openedFile => openedFile.url !== file.url);
  },

  addToOpenedFiles(file) {
    const openFile = file;

    const openedFilesAlreadyExists = Store.openedFiles
      .some(openedFile => openedFile.url === openFile.url);

    if (openedFilesAlreadyExists) return;

    openFile.changed = false;
    Store.openedFiles.push(openFile);
  },

  setDirectoryOpen(tree) {
    if (!tree) return;

    /* eslint-disable no-param-reassign */
    tree.opened = true;
    tree.icon = 'fa-folder-open';
    /* eslint-enable no-param-reassign */
  },

  getRawURLFromBlobURL(url) {
    return url.replace('blob', 'raw');
  },

  getBlameURLFromBlobURL(url) {
    return url.replace('blob', 'blame');
  },

  getHistoryURLFromBlobURL(url) {
    return url.replace('blob', 'commits');
  },

  setBinaryDataAsBase64(url, file) {
    Service.getBase64Content(url)
    .then((response) => {
      Store.blobRaw = response;
      file.base64 = response; // eslint-disable-line no-param-reassign
    })
    .catch(this.loadingError);
  },

  setActiveFileContents(contents) {
    if (!Store.editMode) return;

    Store.activeFile.newContent = contents;
    Store.activeFile.changed = Store.activeFile.plain !== Store.activeFile.newContent;
    Store.openedFiles[Store.activeFileIndex].changed = Store.activeFile.changed;
  },

  toggleFakeTab(loading, file) {
    if (loading) return this.addPlaceholderFile();
    return this.removeFromOpenedFiles(file);
  },

  addPlaceholderFile() {
    const randomURL = this.Time.now();
    const newFakeFile = {
      active: false,
      binary: true,
      type: 'blob',
      loading: true,
      mime_type: 'loading',
      name: 'loading',
      url: randomURL,
    };

    Store.openedFiles.push(newFakeFile);

    return newFakeFile;
  },

  setLoading(loading, file) {
    if (Service.url.indexOf('blob') > -1) {
      Store.loading.blob = loading;
      return this.toggleFakeTab(loading, file);
    }

    if (Service.url.indexOf('tree') > -1) Store.loading.tree = loading;

    return undefined;
  },

  getContent(treeOrFile) {
    let file = treeOrFile;
    const loadingData = this.setLoading(true);

    Service.getContent()
    .then((response) => {
      const data = response.data;
      this.setLoading(false, loadingData);
      Store.isTree = this.isTree(data);
      if (!Store.isTree) {
        if (!file) file = data;
        Store.binary = data.binary;

        if (data.binary) {
          Store.binaryMimeType = data.mime_type;
          const rawUrl = this.getRawURLFromBlobURL(file.url);
          this.setBinaryDataAsBase64(rawUrl, data);
          data.binary = true;
        } else {
          Store.blobRaw = data.plain;
          data.binary = false;
        }

        if (!file.url) file.url = location.pathname;

        data.url = file.url;
        data.newContent = '';
        this.addToOpenedFiles(data);
        this.setActiveFile(data);

        // if the file tree is empty
        if (Store.files.length === 0) {
          const parentURL = this.blobURLtoParent(Service.url);
          Service.url = parentURL;
          this.getContent();
        }
      } else {
        // it's a tree
        this.setDirectoryOpen(file);
        const newDirectory = this.dataToListOfFiles(data);
        Store.files = this.insertNewFilesIntoParentDir(file, Store.files, newDirectory);
        Store.prevURL = this.blobURLtoParent(Service.url);
      }
    })
    .catch(() => {
      this.setLoading(false, loadingData);
      this.loadingError();
    });
  },

  toFA(icon) {
    return `fa-${icon}`;
  },

  /* eslint-disable no-param-reassign */
  removeChildFilesOfTree(tree) {
    let foundTree = false;
    Store.files = Store.files.filter((file) => {
      if (file.url === tree.url) foundTree = true;

      if (foundTree) return file.level <= tree.level;
      return true;
    });

    tree.opened = false;
    tree.icon = 'fa-folder';
  },
  /* eslint-enable no-param-reassign */

  serializeBlob(blob) {
    const simpleBlob = this.serializeRepoEntity('blob', blob);
    simpleBlob.lastCommitMessage = blob.last_commit.message;
    simpleBlob.lastCommitUpdate = blob.last_commit.committed_date;

    return simpleBlob;
  },

  serializeTree(tree) {
    return this.serializeRepoEntity('tree', tree);
  },

  serializeSubmodule(submodule) {
    return this.serializeRepoEntity('submodule', submodule);
  },

  serializeRepoEntity(type, entity) {
    const { url, name, icon } = entity;

    return {
      type,
      name,
      url,
      icon: this.toFA(icon),
      level: 0,
    };
  },

  dataToListOfFiles(data) {
    const a = [];

    // push in blobs
    data.blobs.forEach((blob) => {
      a.push(this.serializeBlob(blob));
    });

    data.trees.forEach((tree) => {
      a.push(this.serializeTree(tree));
    });

    data.submodules.forEach((submodule) => {
      a.push(this.serializeSubmodule(submodule));
    });

    return a;
  },

  genKey() {
    return this.Time.now().toFixed(3);
  },

  getStateKey() {
    return this.key;
  },

  setStateKey(key) {
    this.key = key;
  },

  toURL(url) {
    const history = window.history;

    this.key = this.genKey();

    history.pushState({ key: this.key }, '', url);
  },

  loadingError() {
    new Flash('Unable to load the file at this time.'); // eslint-disable-line no-new
  },
};

export default RepoHelper;
