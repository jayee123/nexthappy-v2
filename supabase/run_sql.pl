#!/usr/bin/perl
# 用 Supabase Management API 執行單一 SQL 檔（透過 curl，避免 shell 轉義地獄）
# 用法：perl run_sql.pl <ref> <token> <sql_file> [--prefix-search-path]
use strict; use warnings;

my ($ref, $token, $file, $flag) = @ARGV;
die "usage: run_sql.pl <ref> <token> <sql_file> [--prefix-search-path]\n" unless $ref && $token && $file;

open(my $fh, '<:raw', $file) or die "cannot open $file: $!";
local $/;
my $sql = <$fh>;
close $fh;

if (($flag // '') eq '--prefix-search-path') {
  $sql = "SET search_path TO happy, public;\n" . $sql;
}

# JSON-escape the SQL string
sub json_escape {
  my ($s) = @_;
  $s =~ s/\\/\\\\/g;
  $s =~ s/"/\\"/g;
  $s =~ s/\n/\\n/g;
  $s =~ s/\r/\\r/g;
  $s =~ s/\t/\\t/g;
  return $s;
}

my $payload = '{"query":"' . json_escape($sql) . '"}';

my $payload_file = "$file.payload.json";
open(my $out, '>:raw', $payload_file) or die "cannot write $payload_file: $!";
print $out $payload;
close $out;

print "==> Executing $file (" . length($sql) . " bytes)\n";

my $cmd = qq{curl -s -w "\\nHTTP_STATUS:%{http_code}" -X POST "https://api.supabase.com/v1/projects/$ref/database/query" -H "Authorization: Bearer $token" -H "Content-Type: application/json" --data-binary \@"$payload_file"};
my $response = `$cmd`;

unlink $payload_file;

if ($response =~ /HTTP_STATUS:(\d+)\s*$/) {
  my $status = $1;
  my $body = $response;
  $body =~ s/\nHTTP_STATUS:\d+\s*$//;
  if ($status eq '200' || $status eq '201') {
    print "OK ($status)\n";
    print "$body\n" if length($body) < 2000;
    exit 0;
  } else {
    print "FAILED (HTTP $status)\n";
    print "$body\n";
    exit 1;
  }
} else {
  print "UNKNOWN RESPONSE:\n$response\n";
  exit 1;
}
