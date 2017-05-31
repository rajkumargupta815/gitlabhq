import FilterableList from '~/filterable_list';

export default class GroupFilterableList extends FilterableList {
  constructor(form, filter, holder, store) {
    super(form, filter, holder);

    this.store = store;
    this.$dropdown = $('.js-group-filter-dropdown-wrap');
  }

  bindEvents() {
    super.bindEvents();

    this.onFormSubmitWrapper = this.onFormSubmit.bind(this);
    this.onFilterOptionClikWrapper = this.onOptionClick.bind(this);

    this.filterForm.addEventListener('submit', this.onFormSubmitWrapper);
    this.$dropdown.on('click', 'a', this.onFilterOptionClikWrapper);
  }

  onFormSubmit(e) {
    e.preventDefault();

    this.filterResults();
  }

  onOptionClick(e) {
    e.preventDefault();
    const currentOption = $.trim(e.currentTarget.text);

    this.filterUrl = e.currentTarget.href;
    this.$dropdown.find('.dropdown-label').text(currentOption);
    this.filterResults(this.filterUrl);
  }

  onFilterSuccess(data, textStatus, xhr) {
    super.onFilterSuccess(data);

    this.store.setGroups(data);
    this.store.storePagination({
      'X-Per-Page': xhr.getResponseHeader('X-Per-Page'),
      'X-Page': xhr.getResponseHeader('X-Page'),
      'X-Total': xhr.getResponseHeader('X-Total'),
      'X-Total-Pages': xhr.getResponseHeader('X-Total-Pages'),
      'X-Next-Page': xhr.getResponseHeader('X-Next-Page'),
      'X-Prev-Page': xhr.getResponseHeader('X-Prev-Page'),
    });
  }
}
