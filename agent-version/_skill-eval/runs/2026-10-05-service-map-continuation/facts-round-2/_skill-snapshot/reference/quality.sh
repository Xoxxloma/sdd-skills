#!/usr/bin/env bash
# Insert/refresh only the generated limitations block in a prepared card.
# quality.sh <draft> <complete-report.tsv> <date> <scope> [selected-class-key.tsv]
# Full scan replaces the block; a partial scan requires explicit selected class/key pairs.
set -eu
CARD="${1:?черновик}"; REPORT="${2:?полный TSV}"; DATE="${3:?дата}"; SCOPE="${4:?область}"
SELECTED="${5:-}"
command -v perl >/dev/null 2>&1 || { echo 'ОТКАЗ: для quality.sh нужен Perl' >&2; exit 2; }
perl - "$CARD" "$REPORT" "$DATE" "$SCOPE" "$SELECTED" <<'PERL'
use strict; use warnings;
use MIME::Base64 qw(encode_base64 decode_base64);
use File::Temp qw(tempfile);
use File::Basename qw(dirname);
my ($cardfile,$reportfile,$date,$scope,$selectedfile)=@ARGV;
sub readall { my ($p)=@_; open my $f,'<:raw',$p or die "ОТКАЗ: нет входа $p: $!\n";local $/;my $s=<$f>;close $f;return $s; }
my $card=readall($cardfile);
$date =~ /^\d{4}-\d{2}-\d{2}$/ or die "ОТКАЗ: дата\n";
$scope =~ /[\t\r\n]/ and die "ОТКАЗ: область содержит разделитель\n";
my $full=$scope eq 'полный скан';
my %selected;
unless($full) {
  length($selectedfile) or die "ОТКАЗ: частичная проверка требует перечень класса и ключа\n";
  for my $line (split /\r?\n/,readall($selectedfile)) {
    next unless length $line;
    my @a=split /\t/,$line,-1;
    @a==2 && length($a[0]) && length($a[1]) or die "ОТКАЗ: некорректный выбранный ключ\n";
    $selected{"$a[0]\t$a[1]"}=1;
  }
}
my $start='<!-- service-map: ограничения -->';my $end='<!-- /service-map: ограничения -->';
my $starts=()=$card=~/\Q$start\E/g;my $ends=()=$card=~/\Q$end\E/g;
$starts==$ends && $starts<=1 or die "ОТКАЗ: повреждённые границы ограничений\n";
my ($old)=$card=~/(\Q$start\E.*?\Q$end\E(?:\r?\n)?)/s;
my @rows;
if(!$full && defined $old) {
  my @encoded=$old=~/<!-- sm-limit:([A-Za-z0-9+\/=]+) -->/g;
  my @quotes=$old=~/^> (?:Добор|Проверить|Фактов|Не проверено|Ограничение)/mg;
  @quotes==@encoded or die "ОТКАЗ: частично обновлять ограничения без машинных строк нельзя\n";
  for my $encoded (@encoded) {
    my $line=decode_base64($encoded);my @a=split /\t/,$line,-1;
    @a==9 or die "ОТКАЗ: повреждённая строка ограничений\n";
    push @rows,$line unless $selected{"$a[1]\t$a[2]"};
  }
}
my @input=split /\r?\n/,readall($reportfile);
my $header=shift @input;
defined($header) && $header eq "категория\tкласс\tключ\tисточник\tфайл карточки\tстрока\tописание" or die "ОТКАЗ: заголовок TSV\n";
for my $line (@input) {
  next unless length $line;my @a=split /\t/,$line,-1;
  @a==7 or die "ОТКАЗ: в TSV не семь полей\n";
  $a[0]=~/^(добор-ключ|добор-факт|проверить-форму|пустой-блок|не-проверено|справка)$/ or die "ОТКАЗ: неизвестная категория\n";
  next if $a[0] eq 'справка';
  next unless $full || $selected{"$a[1]\t$a[2]"};
  push @rows,"$line\t$date\t$scope";
}
my %seen;@rows=grep {!$seen{$_}++} @rows;
my %label=('добор-ключ'=>'Добор ключа','добор-факт'=>'Добор факта',
 'проверить-форму'=>'Проверить форму','пустой-блок'=>'Фактов в блоке нет','не-проверено'=>'Не проверено');
my $block="$start\n> Ограничения слепка — проверка $date, $scope; пунктов ".scalar(@rows).".\n";
$block.="> Предупреждения не являются подтверждением полной достоверности карточки.\n";
for my $line (@rows) {
  my @a=split /\t/,$line,-1;my ($key,$description,$source)=@a[2,6,3];
  for($key,$description,$source){s/`/&#96;/g;s/</&lt;/g;s/>/&gt;/g;}
  $block.='<!-- sm-limit:'.encode_base64($line,'')." -->\n";
  $block.="> $label{$a[0]}: $a[1] `$key` — $description";
  $block.=" (источник: `$source`)" if length($source);
  $block.=" (проверка: $a[7], $a[8]).\n";
}
$block.="$end\n";
my $new=$card;
if(defined $old) {$new=~s/\Q$old\E/$block/;}
else {
  $new=~/^> Генерируется[^\r\n]*(?:\r?\n|$)(?:>[^\r\n]*(?:\r?\n|$))*/m or die "ОТКАЗ: нет строки Генерируется\n";
  my $offset=$+[0];substr($new,$offset,0)=($offset && substr($new,$offset-1,1) ne "\n"?"\n":"").$block;
}
if($new ne $card) {
  my ($f,$tmp)=tempfile('.quality-XXXXXX',DIR=>dirname($cardfile),UNLINK=>0);
  binmode $f;print {$f} $new or die "ОТКАЗ: запись $tmp\n";close($f) or die "ОТКАЗ: закрытие $tmp\n";
  chmod((stat($cardfile))[2]&07777,$tmp) or die "ОТКАЗ: права $tmp\n";
  rename($tmp,$cardfile) or die "ОТКАЗ: продвижение $tmp: $!\n";
}
print "ограничения: ".scalar(@rows)." — $cardfile\n";
PERL
