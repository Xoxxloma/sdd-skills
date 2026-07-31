alter table site add constraint uq_site_address unique (address_normalized);
comment on column site.address_normalized is
    'null пока фоновая нормализация не отработала; уникальность не мешает — null не конфликтует';
